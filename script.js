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

// --- DAFTAR AKUN ADMIN (Username : Password) ---
// Kamu bisa tambah akun di sini
const ADMIN_ACCOUNTS = {
    "admin": "admin123",
    "cahyo": "balikpapan2025",
    "kadis": "rahasia"
};

let calendar;
let isAdmin = false; // Default bukan admin
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
            let timeText = arg.timeText; // Jam otomatis dari FullCalendar
            let isAllDay = arg.event.allDay;

            let colorClass = 'bg-primary'; 
            if(type === 'pagi') colorClass = 'bg-primary'; 
            if(type === 'siang') colorClass = 'bg-warning text-dark'; 
            if(type === 'malam') colorClass = 'bg-secondary'; 
            // Kalau jam manual (custom), warnanya ungu
            if(!type && !isAllDay) colorClass = 'bg-info text-dark';

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
                handleAdminEdit(info); // Admin Edit
            } else {
                handleUserView(info);  // User Lihat Detail
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
            else if(!data.allDay) data.color = '#0dcaf0'; // Warna Jam Manual

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
    
    // Cek tampilan waktu
    if (event.allDay) waktu = "📅 Seharian Penuh";
    else if (event.extendedProps.waktuType) waktu = "🕒 Sesi: " + event.extendedProps.waktuType.toUpperCase();
    else {
        // Format jam manual
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

// --- FITUR 2: TAMBAH JADWAL PINTAR (ADMIN) ---
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
                    <option value="pagi">🌅 Pagi</option>
                    <option value="siang">☀️ Siang</option>
                    <option value="malam">🌙 Malam</option>
                </select>

                <label class="form-label fw-bold small">Atau Jam Manual (Opsional)</label>
                <div class="d-flex gap-2">
                    <input type="time" id="swal-start" class="form-control">
                    <span class="align-self-center">-</span>
                    <input type="time" id="swal-end" class="form-control">
                </div>
                <div class="form-text small text-muted fst-italic mt-1">*Jika sesi & jam dikosongkan, otomatis jadi "Seharian (All Day)"</div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
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
        let title = formValues.title;
        let type = formValues.type; 
        let jamStart = formValues.jamStart;
        let jamEnd = formValues.jamEnd;
        let isAllDay = false;
        
        let startIso = info.startStr; // YYYY-MM-DD
        let endIso = info.endStr;     // YYYY-MM-DD

        // LOGIKA PENENTUAN WAKTU
        if (type) {
            // Kasus 1: Pilih Sesi (Pagi/Siang/Malam) -> All Day False, Jam Dummy
            startIso += 'T08:00'; 
            endIso = startIso;
        } else if (jamStart) {
            // Kasus 2: Isi Jam Manual -> All Day False, Jam Sesuai Input
            startIso += 'T' + jamStart;
            if(jamEnd) {
                // End date harus sama dengan start date kalau input jam manual di hari yang sama
                endIso = info.startStr + 'T' + jamEnd; 
            } else {
                endIso = null;
            }
        } else {
            // Kasus 3: Kosong Semua -> All Day True
            isAllDay = true;
            // startIso & endIso biarkan format tanggal saja (YYYY-MM-DD)
        }

        db.collection("events").add({
            title: title,
            start: startIso,
            end: endIso,
            waktuType: type || null, // Kirim null kalau string kosong
            allDay: isAllDay
        })
        .then(() => Swal.fire({icon: 'success', title: 'Tersimpan', timer: 1000, showConfirmButton: false}))
        .catch((err) => Swal.fire('Error', err.message, 'error'));
    }
}

// --- FITUR 3: LOGIN ADMIN DENGAN PASSWORD ---
async function toggleAdmin() {
    if (isAdmin) {
        // LOGOUT
        isAdmin = false;
        currentUser = "";
        updateAdminButton();
        Swal.fire('Logout Berhasil', 'Mode kembali ke User', 'info');
    } else {
        // LOGIN FORM
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
            // Cek Username & Password
            let storedPass = ADMIN_ACCOUNTS[formValues.user];
            
            if (storedPass && storedPass === formValues.pass) {
                isAdmin = true;
                currentUser = formValues.user;
                updateAdminButton();
                Swal.fire({
                    icon: 'success', 
                    title: `Halo, ${currentUser}!`, 
                    text: 'Mode Edit Aktif'
                });
            } else {
                Swal.fire({
                    icon: 'error', 
                    title: 'Gagal', 
                    text: 'Username atau Password salah!'
                });
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

// Edit/Hapus (Hanya Admin)
async function handleAdminEdit(info) {
    Swal.fire({
        title: 'Kelola Jadwal',
        html: `<p class="fw-bold">${info.event.title}</p><p class="small text-muted">Apa yang ingin dilakukan?</p>`,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '🗑️ Hapus',
        confirmButtonColor: '#d33',
        denyButtonText: '✏️ Edit Judul',
        denyButtonColor: '#f39c12',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        // HAPUS
        if (result.isConfirmed) {
            db.collection("events").doc(info.event.id).delete();
            Swal.fire('Terhapus', '', 'success');
        } 
        // EDIT JUDUL
        else if (result.isDenied) {
            const { value: newTitle } = await Swal.fire({
                input: 'text',
                inputLabel: 'Ubah Judul',
                inputValue: info.event.title,
                showCancelButton: true
            });
            if (newTitle) {
                db.collection("events").doc(info.event.id).update({ title: newTitle });
                Swal.fire('Diupdate', '', 'success');
            }
        }
    });
}