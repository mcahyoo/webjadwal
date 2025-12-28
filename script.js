// --- 1. KONFIGURASI FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDg8ipVCr5-UDgf2IJ2CNZRKPtzVbnGULs",
    authDomain: "jadwaldaerah.firebaseapp.com",
    projectId: "jadwaldaerah",
    storageBucket: "jadwaldaerah.firebasestorage.app",
    messagingSenderId: "1053701460860",
    appId: "1:1053701460860:web:a5236b09fbbb8d88b20af9"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();
db.enablePersistence().catch(err => console.log("Persistence error", err));

let calendar;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'id',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        editable: false, 
        selectable: false, 
        height: 'auto',
        eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false },

        // --- TAMPILAN CUSTOM (ALL DAY vs SESI vs JAM) ---
        eventContent: function(arg) {
            let type = arg.event.extendedProps.waktuType;
            let title = arg.event.title;
            let isAllDay = arg.event.allDay;
            let htmlContent = '';

            if (isAllDay) {
                // KASUS 1: SEHARIAN (ALL DAY)
                // Tampilannya blok warna, tanpa jam
                htmlContent = `<span class="badge bg-primary text-white">Seharian</span> ${title}`;
            } 
            else if (type) {
                // KASUS 2: OPSI CEPAT (Pagi/Siang/Malam)
                let label = '';
                let badgeClass = '';
                if(type === 'pagi')  { label = '🌅 Pagi'; badgeClass = 'text-primary'; }
                if(type === 'siang') { label = '☀️ Siang'; badgeClass = 'text-warning'; }
                if(type === 'malam') { label = '🌙 Malam'; badgeClass = 'text-secondary'; }
                htmlContent = `<span class="${badgeClass}">●</span> <b>${label}:</b> ${title}`;
            } 
            else {
                // KASUS 3: MANUAL JAM
                let startTime = arg.event.start.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
                let endTime = arg.event.end ? ' - ' + arg.event.end.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '';
                htmlContent = `<div style="font-weight:bold; color:#1a73e8;">${startTime}${endTime}</div><div>${title}</div>`;
            }

            return { html: `<div class='fc-event-main-frame'><div class='fc-event-title-container'><div class='fc-event-title'>${htmlContent}</div></div></div>` };
        },

        // --- 1. KLIK TANGGAL (TAMBAH DATA) ---
        select: async function(info) {
            if (!isAdmin) return;
            let dateBase = info.startStr;
            if(info.view.type !== 'dayGridMonth') dateBase = info.startStr.substring(0, 10);

            const { value: formValues } = await Swal.fire({
                title: '📅 Jadwal Baru',
                html: `
                    <div class="text-start mb-3">
                        <label class="form-label fw-bold">Judul Kegiatan</label>
                        <input id="swal-title" class="form-control" placeholder="Contoh: HUT Kota">
                    </div>

                    <div class="form-check form-switch text-start mb-3 p-3 bg-light rounded border">
                        <input class="form-check-input" type="checkbox" id="swal-allday" style="cursor:pointer">
                        <label class="form-check-label fw-bold" for="swal-allday" style="cursor:pointer">📅 Seharian Penuh (All Day)</label>
                    </div>

                    <div id="time-wrapper">
                        <div class="mb-3 text-center">
                            <label class="small text-muted mb-2 d-block">— Atau Pilih Sesi —</label>
                            <div class="btn-group w-100" role="group">
                                <input type="radio" class="btn-check" name="waktu" id="opt-pagi" value="pagi" autocomplete="off">
                                <label class="btn btn-outline-primary" for="opt-pagi">🌅 Pagi</label>
                                <input type="radio" class="btn-check" name="waktu" id="opt-siang" value="siang" autocomplete="off">
                                <label class="btn btn-outline-warning text-dark" for="opt-siang">☀️ Siang</label>
                                <input type="radio" class="btn-check" name="waktu" id="opt-malam" value="malam" autocomplete="off">
                                <label class="btn btn-outline-secondary" for="opt-malam">🌙 Malam</label>
                            </div>
                        </div>

                        <div class="row g-2 text-start">
                            <div class="col-6">
                                <label class="form-label small fw-bold">Jam Mulai</label>
                                <input id="swal-start" type="datetime-local" class="form-control">
                            </div>
                            <div class="col-6">
                                <label class="form-label small fw-bold">Jam Selesai</label>
                                <input id="swal-end" type="datetime-local" class="form-control">
                            </div>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Simpan',
                
                // LOGIKA UI (HIDE/SHOW WAKTU)
                didOpen: () => {
                    const allDayCheck = document.getElementById('swal-allday');
                    const timeWrapper = document.getElementById('time-wrapper');
                    
                    allDayCheck.addEventListener('change', (e) => {
                        if(e.target.checked) {
                            timeWrapper.style.display = 'none'; // Sembunyikan jam
                        } else {
                            timeWrapper.style.display = 'block'; // Munculkan jam
                        }
                    });
                },

                preConfirm: () => {
                    const title = document.getElementById('swal-title').value;
                    const isAllDay = document.getElementById('swal-allday').checked;
                    
                    let start = document.getElementById('swal-start').value;
                    let end = document.getElementById('swal-end').value;
                    const waktuChosen = document.querySelector('input[name="waktu"]:checked')?.value;

                    if (!title) { Swal.showValidationMessage('Judul wajib diisi!'); return false; }

                    // Logika Validasi
                    if (!isAllDay) {
                        // Kalau BUKAN All Day, maka Wajib isi Jam / Pilih Sesi
                        if (waktuChosen) {
                            const mapStart = { 'pagi': '08:00', 'siang': '13:00', 'malam': '19:00' };
                            const mapEnd = { 'pagi': '12:00', 'siang': '18:00', 'malam': '22:00' };
                            if(!start) start = dateBase + 'T' + mapStart[waktuChosen];
                            if(!end) end = dateBase + 'T' + mapEnd[waktuChosen];
                        } else {
                            if (!start || !end) { Swal.showValidationMessage('Isi jam manual, pilih sesi, atau centang All Day!'); return false; }
                        }
                    } else {
                        // Kalau All Day, start/end kita set tanggalnya aja (tanpa jam Txx:xx)
                        start = dateBase; 
                        end = dateBase;
                    }

                    return { title, start, end, waktuType: waktuChosen || null, allDay: isAllDay }
                }
            });

            if (formValues) {
                db.collection("events").add({
                    title: formValues.title, start: formValues.start, end: formValues.end,
                    waktuType: formValues.waktuType,
                    allDay: formValues.allDay, // Simpan status All Day
                    color: '#3788d8'
                }).then(() => {
                    Swal.fire({icon: 'success', title: 'Tersimpan', timer: 1000, showConfirmButton: false});
                });
            }
            calendar.unselect();
        },

        // --- 2. KLIK JADWAL (EDIT / HAPUS) ---
        eventClick: async function(info) {
            const toLocalISO = (date) => {
                if(!date) return '';
                const offset = date.getTimezoneOffset() * 60000;
                return new Date(date.getTime() - offset).toISOString().slice(0, 16);
            };

            let displayTime = '';
            let type = info.event.extendedProps.waktuType;
            let isAllDay = info.event.allDay;
            
            if (isAllDay) displayTime = '📅 Seharian Penuh';
            else if (type === 'pagi') displayTime = '🌅 Waktu: Pagi';
            else if (type === 'siang') displayTime = '☀️ Waktu: Siang';
            else if (type === 'malam') displayTime = '🌙 Waktu: Malam';
            else {
                displayTime = info.event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                if(info.event.end) displayTime += ' - ' + info.event.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }

            if (!isAdmin) {
                Swal.fire({ title: info.event.title, html: `<p class="fs-4">📅 ${info.event.start.toLocaleDateString('id-ID')}</p><p class="badge bg-info text-dark fs-6">${displayTime}</p>`, icon: 'info' });
                return;
            }

            const result = await Swal.fire({
                title: '⚙️ Atur Kegiatan',
                html: `<h3 class="text-primary">${info.event.title}</h3><p class="fw-bold text-muted">${displayTime}</p>`,
                showDenyButton: true, showCancelButton: true,
                confirmButtonText: '✏️ Edit', confirmButtonColor: '#f39c12',
                denyButtonText: '🗑️ Hapus', denyButtonColor: '#d33', cancelButtonText: 'Batal'
            });

            if (result.isDenied) {
                Swal.fire({ title: 'Hapus permanen?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya', confirmButtonColor: '#d33' }).then((res) => {
                    if (res.isConfirmed) { db.collection("events").doc(info.event.id).delete(); info.event.remove(); Swal.fire('Terhapus!', '', 'success'); }
                });
            } else if (result.isConfirmed) {
                // SETTING NILAI AWAL FORM EDIT
                let checkedPagi = type === 'pagi' ? 'checked' : '';
                let checkedSiang = type === 'siang' ? 'checked' : '';
                let checkedMalam = type === 'malam' ? 'checked' : '';
                let checkedAllDay = isAllDay ? 'checked' : '';
                let wrapperStyle = isAllDay ? 'none' : 'block'; // Sembunyikan jam kalau allday

                const { value: formValues } = await Swal.fire({
                    title: '✏️ Edit Kegiatan',
                    html: `
                        <div class="text-start mb-3">
                            <label class="form-label fw-bold">Judul Kegiatan</label>
                            <input id="swal-edit-title" class="form-control" value="${info.event.title}">
                        </div>

                        <div class="form-check form-switch text-start mb-3 p-3 bg-light rounded border">
                            <input class="form-check-input" type="checkbox" id="swal-edit-allday" ${checkedAllDay} style="cursor:pointer">
                            <label class="form-check-label fw-bold" for="swal-edit-allday" style="cursor:pointer">📅 Seharian Penuh (All Day)</label>
                        </div>

                        <div id="edit-time-wrapper" style="display:${wrapperStyle}">
                            <div class="mb-3 text-center">
                                <div class="btn-group w-100" role="group">
                                    <input type="radio" class="btn-check" name="waktu_edit" id="e-pagi" value="pagi" autocomplete="off" ${checkedPagi}>
                                    <label class="btn btn-outline-primary" for="e-pagi">🌅 Pagi</label>
                                    <input type="radio" class="btn-check" name="waktu_edit" id="e-siang" value="siang" autocomplete="off" ${checkedSiang}>
                                    <label class="btn btn-outline-warning text-dark" for="e-siang">☀️ Siang</label>
                                    <input type="radio" class="btn-check" name="waktu_edit" id="e-malam" value="malam" autocomplete="off" ${checkedMalam}>
                                    <label class="btn btn-outline-secondary" for="e-malam">🌙 Malam</label>
                                </div>
                            </div>

                            <div class="row g-2 text-start">
                                <div class="col-6">
                                    <label class="form-label small fw-bold">Jam Mulai</label>
                                    <input id="swal-edit-start" type="datetime-local" class="form-control" value="${toLocalISO(info.event.start)}">
                                </div>
                                <div class="col-6">
                                    <label class="form-label small fw-bold">Jam Selesai</label>
                                    <input id="swal-edit-end" type="datetime-local" class="form-control" value="${toLocalISO(info.event.end)}">
                                </div>
                            </div>
                        </div>
                    `,
                    focusConfirm: false,
                    didOpen: () => {
                        const allDayCheck = document.getElementById('swal-edit-allday');
                        const timeWrapper = document.getElementById('edit-time-wrapper');
                        allDayCheck.addEventListener('change', (e) => {
                            timeWrapper.style.display = e.target.checked ? 'none' : 'block';
                        });
                    },
                    preConfirm: () => {
                        const title = document.getElementById('swal-edit-title').value;
                        const isAllDay = document.getElementById('swal-edit-allday').checked;
                        let start = document.getElementById('swal-edit-start').value;
                        let end = document.getElementById('swal-edit-end').value;
                        const waktuChosen = document.querySelector('input[name="waktu_edit"]:checked')?.value;

                        if (!title) { Swal.showValidationMessage('Judul tidak boleh kosong!'); return false; }

                        if (!isAllDay) {
                            if (waktuChosen) {
                                const mapStart = { 'pagi': '08:00', 'siang': '13:00', 'malam': '19:00' };
                                const mapEnd = { 'pagi': '12:00', 'siang': '16:00', 'malam': '21:00' };
                                let datePart = start.substring(0, 10);
                                if(!datePart && info.event.startStr) datePart = info.event.startStr.substring(0,10);
                                start = datePart + 'T' + mapStart[waktuChosen];
                                end = datePart + 'T' + mapEnd[waktuChosen];
                            } else {
                                if (!start || !end) { Swal.showValidationMessage('Jam harus diisi!'); return false; }
                            }
                        } else {
                            // Reset jam jika jadi all day
                            if(info.event.startStr) start = info.event.startStr.substring(0,10);
                            end = start;
                        }
                        return { title, start, end, waktuType: waktuChosen || null, allDay: isAllDay }
                    }
                });

                if (formValues) {
                    db.collection("events").doc(info.event.id).update(formValues).then(() => {
                        info.event.setProp('title', formValues.title);
                        info.event.setStart(formValues.start);
                        info.event.setEnd(formValues.end);
                        info.event.setExtendedProp('waktuType', formValues.waktuType);
                        info.event.setAllDay(formValues.allDay);
                        Swal.fire('Berhasil Update!', '', 'success');
                    });
                }
            }
        },

        eventDrop: function(info) {
            if (!isAdmin) { info.revert(); return; }
            db.collection("events").doc(info.event.id).update({
                start: info.event.startStr, end: info.event.endStr || null, allDay: info.event.allDay
            });
        }
    });

    calendar.render();

    db.collection("events").onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") calendar.addEvent({ id: change.doc.id, ...change.doc.data() });
            if (change.type === "modified") {
                let event = calendar.getEventById(change.doc.id);
                if(event) {
                    event.setProp('title', change.doc.data().title);
                    event.setStart(change.doc.data().start);
                    event.setEnd(change.doc.data().end);
                    event.setExtendedProp('waktuType', change.doc.data().waktuType);
                    event.setAllDay(change.doc.data().allDay);
                }
            }
            if (change.type === "removed") {
                let event = calendar.getEventById(change.doc.id);
                if(event) event.remove();
            }
        });

        const spinner = document.getElementById('loadingSpinner');
        const calDiv = document.getElementById('calendar');
        if (spinner && spinner.style.display !== 'none') {
            spinner.style.display = 'none';
            calDiv.style.opacity = '1';
        }
    });
});

function toggleAdmin() {
    if (isAdmin) {
        isAdmin = false;
        document.getElementById('adminBadge').style.display = 'none';
        document.getElementById('btnLogin').innerHTML = '<i class="bi bi-lock-fill"></i> Admin Login';
        document.getElementById('btnLogin').classList.replace('btn-danger', 'btn-outline-primary');
        calendar.setOption('editable', fgtalse);
        calendar.setOption('selectable', false);
        Swal.fire('Logout', 'Sampai jumpa Admin!', 'info');
    } else {
        Swal.fire({
            title: '🔐 Login Admin',
            input: 'password',
            showCancelButton: true
        }).then((result) => {
            if (result.value === "rahasia123") {
                isAdmin = true;
                document.getElementById('adminBadge').style.display = 'block';
                document.getElementById('btnLogin').innerHTML = '<i class="bi bi-unlock-fill"></i> Logout';
                document.getElementById('btnLogin').classList.replace('btn-outline-primary', 'btn-danger');
                calendar.setOption('editable', true);
                calendar.setOption('selectable', true);
                Swal.fire('Sukses', 'Mode Edit Aktif!', 'success');
            } else if (result.value) {
                Swal.fire('Gagal', 'Password salah', 'error');
            }
        });
    }
}