// --- 1. KONFIGURASI FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDg8ipVCr5-UDgf2IJ2CNZRKPtzVbnGULs",
    authDomain: "jadwaldaerah.firebaseapp.com",
    projectId: "jadwaldaerah",
    storageBucket: "jadwaldaerah.firebasestorage.app",
    messagingSenderId: "1053701460860",
    appId: "1:1053701460860:web:a5236b09fbbb8d88b20af9"
};

// Cek Script
console.log("🚀 Script dimulai...");

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

// --- DAFTAR AKUN ADMIN ---
const ADMIN_ACCOUNTS = {
    "admin": "admin123",
    "cahyo": "balikpapan2025",
    "kadis": "rahasia"
};

let calendar;
let isAdmin = false; 
let currentUser = "";

document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ DOM Loaded.");
    const calendarEl = document.getElementById('calendar');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // Safety Net Loading
    setTimeout(() => {
        if (loadingSpinner && loadingSpinner.style.display !== 'none') {
            loadingSpinner.classList.remove('d-flex');
            loadingSpinner.style.display = 'none';
            if(calendarEl) calendarEl.style.opacity = '1';
        }
    }, 3000);

    // Deteksi Layar
    let initialView = window.innerWidth < 768 ? 'listMonth' : 'dayGridMonth';
    updateActiveMenu(initialView);

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: initialView, 
        locale: 'id',
        headerToolbar: { left: 'today prev,next', center: 'title', right: '' },
        height: '100%',
        navLinks: true, 
        
        // TAMPILAN JADWAL
        eventContent: function(arg) {
            let type = arg.event.extendedProps.waktuType;
            let title = arg.event.title;
            let timeText = arg.timeText; 
            let isAllDay = arg.event.allDay;

            let colorClass = 'bg-primary'; 
            if(type === 'pagi') colorClass = 'bg-primary'; 
            if(type === 'siang') colorClass = 'bg-warning text-dark'; 
            if(type === 'malam') colorClass = 'bg-secondary'; 
            if(!type && !isAllDay) colorClass = 'bg-info text-dark'; // Jam Manual

            // Tampilan List/Minggu/Hari
            if (arg.view.type === 'listMonth' || arg.view.type === 'timeGridWeek' || arg.view.type === 'timeGridDay') {
                return { html: `<div class='fc-content'><b>${title}</b></div>` };
            } 
            // Tampilan Bulan
            return { html: `<div class='fc-event-main-frame ${colorClass} text-white px-1 rounded' style="font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${timeText} ${title}</div>` };
        },
        
        navLinkDayClick: function(date) {
            changeView('timeGridDay', 'Hari');
            calendar.gotoDate(date);
        },
        
        editable: false,
        selectable: true,
        
        // KLIK TANGGAL KOSONG (Hanya Admin)
        select: function(info) { 
            if(isAdmin) handleAdminAdd(info); 
        },
        
        // KLIK JADWAL (Admin = Edit, User = Lihat Detail)
        eventClick: function(info) { 
            if(isAdmin) {
                handleAdminEdit(info); 
            } else {
                handleUserView(info);  
            }
        }
    });

    calendar.render();

    // REALTIME FIREBASE
    db.collection("events").onSnapshot((snapshot) => {
        calendar.removeAllEvents();
        snapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id; 
            // Mapping Warna
            if(data.waktuType === 'pagi') data.color = '#0d6efd';
            else if(data.waktuType === 'siang') data.color = '#ffc107';
            else if(data.waktuType === 'malam') data.color = '#6c757d';
            else if(!data.allDay) data.color = '#0dcaf0'; 

            calendar.addEvent(data);
        });
        
        if(loadingSpinner) {
            loadingSpinner.classList.remove('d-flex');
            loadingSpinner.style.display = 'none';
        }
        if(calendarEl) calendarEl.style.opacity = '1';
    });
});

// --- FUNGSI NAVIGASI ---
function changeView(viewName, label) {
    if(!calendar) return;
    calendar.changeView(viewName);
    document.getElementById('dropdownViewLabel').innerText = label;
    updateActiveMenu(viewName);
    const sidebarEl = document.getElementById('sidebarMenu');
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebarEl);
    if(bsOffcanvas) bsOffcanvas.hide();
}

function updateActiveMenu(viewName) {
    document.querySelectorAll('.sidebar-item, .dropdown-item').forEach(el => el.classList.remove('active'));
    let links = document.querySelectorAll(`[onclick*="${viewName}"]`);
    links.forEach(el => el.classList.add('active'));
}

// --- FITUR 1: USER LIHAT DETAIL ---
function handleUserView(info) {
    let event = info.event;
    let waktu = "";
    
    if (event.allDay) waktu = "📅 Seharian Penuh";
    else if (event.extendedProps.waktuType) {
        let tipe = event.extendedProps.waktuType.toUpperCase();
        let jamMulai = event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        let jamSelesai = event.end ? event.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
        waktu = `🕒 ${tipe} (${jamMulai} - ${jamSelesai})`;
    }
    else {
        let jamMulai = event.start ? event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
        let jamSelesai = event.end ? event.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
        waktu = `⏰ Jam: ${jamMulai} ${jamSelesai ? '- ' + jamSelesai : ''}`;
    }

    Swal.fire({
        title: event.title,
        html: `<div class="alert alert-light text-start border">
                 <p class="mb-1"><strong>Hari:</strong> ${event.start.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                 <p class="mb-0"><strong>${waktu}</strong></p>
               </div>`,
        icon: 'info',
        confirmButtonText: 'Tutup'
    });
}

// --- FITUR 2: TAMBAH JADWAL (ADMIN) ---
async function handleAdminAdd(info) {
    const { value: formValues } = await Swal.fire({
        title: 'Tambah Jadwal Baru',
        html: `
            <div class="text-start">
                <label class="form-label fw-bold small">Judul Kegiatan</label>
                <input id="swal-title" class="form-control mb-3" placeholder="Contoh: Rapat Koordinasi">
                
                <label class="form-label fw-bold small">Pilih Sesi (Opsional)</label>
                <select id="swal-type" class="form-select mb-3">
                    <option value="">-- Tidak Pilih Sesi --</option>
                    <option value="pagi">🌅 Pagi (08:00 - 12:00)</option>
                    <option value="siang">☀️ Siang (13:00 - 18:00)</option>
                    <option value="malam">🌙 Malam (19:00 - 22:00)</option>
                </select>

                <label class="form-label fw-bold small">Atau Jam Manual</label>
                <div class="d-flex gap-2">
                    <input type="time" id="swal-start" class="form-control">
                    <span class="align-self-center">-</span>
                    <input type="time" id="swal-end" class="form-control">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        preConfirm: () => {
            return {
                title: document.getElementById('swal-title').value,
                type: document.getElementById('swal-type').value,
                jamStart: document.getElementById('swal-start').value,
                jamEnd: document.getElementById('swal-end').value
            }
        }
    });

    if (formValues && formValues.title) {
        saveEventToFirebase(
            formValues.title, 
            formValues.type, 
            formValues.jamStart, 
            formValues.jamEnd, 
            info.startStr.split('T')[0] // Ambil tanggal YYYY-MM-DD
        );
    }
}

// --- FITUR 3: EDIT LENGKAP JADWAL (ADMIN) ---
async function handleAdminEdit(info) {
    let event = info.event;
    let props = event.extendedProps;
    
    // Ambil data lama
    let currentTitle = event.title;
    let currentType = props.waktuType || "";
    // Format jam lama ke HH:mm
    let currentStart = event.start ? event.start.toTimeString().substring(0,5) : "";
    let currentEnd = event.end ? event.end.toTimeString().substring(0,5) : "";

    const { value: formValues } = await Swal.fire({
        title: 'Edit Jadwal',
        html: `
            <div class="text-start">
                <label class="form-label fw-bold small">Judul Kegiatan</label>
                <input id="swal-title" class="form-control mb-3" value="${currentTitle}">
                
                <label class="form-label fw-bold small">Pilih Sesi</label>
                <select id="swal-type" class="form-select mb-3">
                    <option value="" ${currentType === '' ? 'selected' : ''}>-- Manual / All Day --</option>
                    <option value="pagi" ${currentType === 'pagi' ? 'selected' : ''}>🌅 Pagi (08:00 - 12:00)</option>
                    <option value="siang" ${currentType === 'siang' ? 'selected' : ''}>☀️ Siang (13:00 - 18:00)</option>
                    <option value="malam" ${currentType === 'malam' ? 'selected' : ''}>🌙 Malam (19:00 - 22:00)</option>
                </select>

                <label class="form-label fw-bold small">Jam Manual</label>
                <div class="d-flex gap-2">
                    <input type="time" id="swal-start" class="form-control" value="${currentStart}">
                    <span class="align-self-center">-</span>
                    <input type="time" id="swal-end" class="form-control" value="${currentEnd}">
                </div>
            </div>
            <div class="mt-3 text-center border-top pt-3">
                <button type="button" class="btn btn-outline-danger btn-sm w-100" id="btn-delete-event">
                    <i class="bi bi-trash"></i> Hapus Jadwal Ini
                </button>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan Perubahan',
        cancelButtonText: 'Batal',
        didOpen: () => {
            // Pasang tombol hapus
            document.getElementById('btn-delete-event').addEventListener('click', () => {
                Swal.close();
                confirmDelete(event.id);
            });
        },
        preConfirm: () => {
            return {
                title: document.getElementById('swal-title').value,
                type: document.getElementById('swal-type').value,
                jamStart: document.getElementById('swal-start').value,
                jamEnd: document.getElementById('swal-end').value
            }
        }
    });

    if (formValues) {
        // Ambil YYYY-MM-DD dari tanggal event yang sedang diedit
        let dateOnly = event.start.getFullYear() + '-' +
                       String(event.start.getMonth() + 1).padStart(2, '0') + '-' +
                       String(event.start.getDate()).padStart(2, '0');

        updateEventInFirebase(
            event.id,
            formValues.title,
            formValues.type,
            formValues.jamStart,
            formValues.jamEnd,
            dateOnly
        );
    }
}

// --- HELPER: SIMPAN/UPDATE LOGIC ---
// Dipisah biar kodingannya rapi (DRY Principle)
function calculateTime(dateBase, type, jamStart, jamEnd) {
    let startIso = dateBase;
    let endIso = dateBase;
    let isAllDay = false;

    if (type) {
        if(type === 'pagi')  { startIso += 'T08:00'; endIso += 'T12:00'; }
        if(type === 'siang') { startIso += 'T13:00'; endIso += 'T18:00'; }
        if(type === 'malam') { startIso += 'T19:00'; endIso += 'T22:00'; }
    } else if (jamStart) {
        startIso += 'T' + jamStart;
        if(jamEnd) endIso += 'T' + jamEnd;
        else endIso = null;
    } else {
        isAllDay = true;
    }
    return { startIso, endIso, isAllDay, type: type || null };
}

function saveEventToFirebase(title, type, jamStart, jamEnd, dateBase) {
    let calc = calculateTime(dateBase, type, jamStart, jamEnd);
    db.collection("events").add({
        title: title,
        start: calc.startIso,
        end: calc.endIso,
        waktuType: calc.type,
        allDay: calc.isAllDay
    })
    .then(() => Swal.fire({icon: 'success', title: 'Tersimpan', timer: 1000, showConfirmButton: false}))
    .catch((err) => Swal.fire('Error', err.message, 'error'));
}

function updateEventInFirebase(id, title, type, jamStart, jamEnd, dateBase) {
    let calc = calculateTime(dateBase, type, jamStart, jamEnd);
    db.collection("events").doc(id).update({
        title: title,
        start: calc.startIso,
        end: calc.endIso,
        waktuType: calc.type,
        allDay: calc.isAllDay
    })
    .then(() => Swal.fire({icon: 'success', title: 'Diupdate', timer: 1000, showConfirmButton: false}))
    .catch((err) => Swal.fire('Error', err.message, 'error'));
}

function confirmDelete(id) {
    Swal.fire({
        title: 'Yakin hapus?',
        text: "Data tidak bisa dikembalikan",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus'
    }).then((res) => {
        if (res.isConfirmed) {
            db.collection("events").doc(id).delete();
            Swal.fire('Terhapus', '', 'success');
        }
    });
}

// --- FITUR 4: LOGIN ---
async function toggleAdmin() {
    if (isAdmin) {
        isAdmin = false;
        currentUser = "";
        updateAdminButton();
        Swal.fire('Logout Berhasil', 'Mode kembali ke User', 'info');
    } else {
        const { value: formValues } = await Swal.fire({
            title: '🔐 Login Admin',
            html: `
                <input id="login-user" class="form-control mb-2" placeholder="Username">
                <input id="login-pass" type="password" class="form-control" placeholder="Password">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Masuk',
            preConfirm: () => {
                return {
                    user: document.getElementById('login-user').value,
                    pass: document.getElementById('login-pass').value
                }
            }
        });

        if (formValues) {
            let storedPass = ADMIN_ACCOUNTS[formValues.user];
            if (storedPass && storedPass === formValues.pass) {
                isAdmin = true;
                currentUser = formValues.user;
                updateAdminButton();
                Swal.fire({icon: 'success', title: `Halo, ${currentUser}!`, text: 'Mode Edit Aktif'});
            } else {
                Swal.fire({icon: 'error', title: 'Gagal', text: 'Username atau Password salah!'});
            }
        }
    }
}

function updateAdminButton() {
    let btn = document.getElementById('btnLogin');
    if (isAdmin) {
        btn.innerHTML = `<i class="bi bi-person-check-fill"></i> ${currentUser} (Logout)`;
        btn.classList.replace('btn-primary', 'btn-danger');
    } else {
        btn.innerHTML = 'Login Admin';
        btn.classList.replace('btn-danger', 'btn-primary');
    }
}