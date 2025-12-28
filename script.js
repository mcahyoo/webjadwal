// --- 1. KONFIGURASI FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDg8ipVCr5-UDgf2IJ2CNZRKPtzVbnGULs",
    authDomain: "jadwaldaerah.firebaseapp.com",
    projectId: "jadwaldaerah",
    storageBucket: "jadwaldaerah.firebasestorage.app",
    messagingSenderId: "1053701460860",
    appId: "1:1053701460860:web:a5236b09fbbb8d88b20af9"
};

// Cek apakah script jalan
console.log("🚀 Script dimulai...");

// Inisialisasi Firebase
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

// Note: Cache Offline dimatikan dulu biar aman di semua browser (Brave/Chrome)

let calendar;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ DOM Loaded. Memulai Kalender...");
    const calendarEl = document.getElementById('calendar');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // 🔥 PENGAMAN ANTI-MACET (SAFETY NET) 🔥
    // Kalau dalam 3 detik loading gak hilang, kita PAKSA hilang
    setTimeout(() => {
        if (loadingSpinner && loadingSpinner.style.display !== 'none') {
            console.warn("⚠️ Waktu habis! Memaksa spinner hilang...");
            loadingSpinner.classList.remove('d-flex'); // TENDANG class Bootstrap
            loadingSpinner.style.display = 'none';
            if(calendarEl) calendarEl.style.opacity = '1';
        }
    }, 3000);

    // DETEKSI LAYAR
    let initialView = window.innerWidth < 768 ? 'listMonth' : 'dayGridMonth';
    updateActiveMenu(initialView);

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: initialView, 
        locale: 'id',
        headerToolbar: {
            left: 'today prev,next',
            center: 'title',
            right: '' 
        },
        height: '100%',
        navLinks: true, 
        
        eventContent: function(arg) {
            let type = arg.event.extendedProps.waktuType;
            let title = arg.event.title;
            let timeText = arg.timeText; 
            
            let colorClass = 'bg-primary'; 
            if(type === 'pagi') colorClass = 'bg-primary'; 
            if(type === 'siang') colorClass = 'bg-warning text-dark'; 
            if(type === 'malam') colorClass = 'bg-secondary'; 

            if (arg.view.type === 'listMonth' || arg.view.type === 'timeGridWeek' || arg.view.type === 'timeGridDay') {
                return { html: `<div class='fc-content'><b>${title}</b></div>` };
            } 
            return { html: `<div class='fc-event-main-frame ${colorClass} text-white px-1 rounded' style="font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${timeText} ${title}</div>` };
        },
        
        navLinkDayClick: function(date, jsEvent) {
            changeView('timeGridDay', 'Hari');
            calendar.gotoDate(date);
        },
        editable: false,
        selectable: true,
        select: function(info) { if(isAdmin) handleAdminAdd(info); },
        eventClick: function(info) { if(isAdmin) handleAdminEdit(info); }
    });

    calendar.render();
    console.log("📅 Kalender dirender.");

    // --- REALTIME LISTENER ---
    console.log("📡 Menghubungkan ke Firebase...");
    db.collection("events").onSnapshot((snapshot) => {
        console.log("🔥 Data diterima: " + snapshot.size + " kegiatan.");
        
        calendar.removeAllEvents();
        snapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id; 
            if(data.waktuType === 'pagi') data.color = '#1a73e8';
            if(data.waktuType === 'siang') data.color = '#f9ab00';
            if(data.waktuType === 'malam') data.color = '#5f6368';
            calendar.addEvent(data);
        });
        
        // MATIKAN SPINNER (SUKSES)
        if(loadingSpinner) {
            loadingSpinner.classList.remove('d-flex'); // HAPUS CLASS BOOTSTRAP
            loadingSpinner.style.display = 'none';
        }
        if(calendarEl) calendarEl.style.opacity = '1';

    }, (error) => {
        console.error("❌ Error Firebase:", error);
        
        // MATIKAN SPINNER (ERROR)
        if(loadingSpinner) {
            loadingSpinner.classList.remove('d-flex'); // HAPUS CLASS BOOTSTRAP
            loadingSpinner.style.display = 'none';
        }
        if(calendarEl) calendarEl.style.opacity = '1';
        
        Swal.fire({icon: 'error', title: 'Gagal Konek Database', text: error.message});
    });
});

// --- FUNGSI PENDUKUNG ---
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

async function handleAdminAdd(info) {
    const { value: formValues } = await Swal.fire({
        title: 'Tambah Jadwal',
        html: `<input id="swal-title" class="form-control mb-2" placeholder="Nama Kegiatan">
               <select id="swal-type" class="form-select">
                   <option value="pagi">Pagi</option>
                   <option value="siang">Siang</option>
                   <option value="malam">Malam</option>
               </select>`,
        focusConfirm: false,
        preConfirm: () => {
            return {
                title: document.getElementById('swal-title').value,
                type: document.getElementById('swal-type').value
            }
        }
    });

    if(formValues) {
        let start = info.startStr;
        let end = info.endStr;
        if(info.allDay) { start += 'T08:00'; end = start; }
        
        db.collection("events").add({
            title: formValues.title, start: start, end: end, waktuType: formValues.type, allDay: false
        })
        .then(() => Swal.fire({icon: 'success', title: 'Disimpan', timer: 1000, showConfirmButton: false}))
        .catch((err) => Swal.fire('Error', err.message, 'error'));
    }
}

async function handleAdminEdit(info) {
    Swal.fire({
        title: info.event.title, text: "Hapus kegiatan ini?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Hapus'
    }).then((res) => {
        if(res.isConfirmed) {
            db.collection("events").doc(info.event.id).delete();
        }
    });
}

function toggleAdmin() {
    isAdmin = !isAdmin;
    let btn = document.getElementById('btnLogin');
    btn.innerHTML = isAdmin ? 'Logout' : 'Login';
    btn.classList.toggle('btn-danger');
    btn.classList.toggle('btn-primary');
    Swal.fire(isAdmin ? 'Mode Admin' : 'Mode User', '', 'success');
}