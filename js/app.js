// Thay URL này bằng link Web App sau khi deploy GAS
const API_URL = 'https://script.google.com/macros/s/AKfycbxMEsirWB11sN-l8VdJK6b9OtyrgmE7oJ91v_ijcPGcIORQLClNIkVWEzDQR6cR77x5/exec'; // Placeholder

let globalData = [];

// DOM Elements
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const closeSidebar = document.getElementById('closeSidebar');
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('pageTitle');

const tableAll = document.getElementById('tbodyAll');
const tableTeam = document.getElementById('tbodyTeam');
const teamFilter = document.getElementById('teamFilter');
const searchInputAll = document.getElementById('searchInputAll');
const searchInputTeam = document.getElementById('searchInputTeam');

const formModal = document.getElementById('formModal');
const btnAddNew = document.getElementById('btnAddNew');
const closeModal = document.getElementById('closeModal');
const btnCancel = document.getElementById('btnCancel');
const btnSave = document.getElementById('btnSave');
const dataForm = document.getElementById('dataForm');
const modalTitle = document.getElementById('modalTitle');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    if (API_URL.includes('AKfy')) { // Only fetch if API is somehow set or use mock
        fetchData();
    } else {
        showToast('Vui lòng cấu hình API_URL trong file app.js', 'error');
    }
});

// Event Listeners
function initEvents() {
    // Sidebar toggle
    menuToggle.addEventListener('click', () => sidebar.classList.add('active'));
    closeSidebar.addEventListener('click', () => sidebar.classList.remove('active'));

    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = item.getAttribute('data-page');

            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${targetPage}`).classList.add('active');

            pageTitle.innerText = item.innerText.trim();
            if (window.innerWidth <= 992) sidebar.classList.remove('active');
        });
    });

    // Search & Filter
    searchInputAll.addEventListener('input', () => renderTable(globalData, 'all'));
    searchInputTeam.addEventListener('input', () => renderTable(globalData, 'team'));
    teamFilter.addEventListener('change', () => renderTable(globalData, 'team'));

    // Modal
    btnAddNew.addEventListener('click', () => openModal());
    closeModal.addEventListener('click', () => formModal.classList.remove('active'));
    btnCancel.addEventListener('click', (e) => {
        e.preventDefault();
        formModal.classList.remove('active');
    });

    // Save Data
    btnSave.addEventListener('click', (e) => {
        e.preventDefault();
        saveData();
    });
}

// Fetch Data
async function fetchData() {
    showLoading(true);
    try {
        const response = await fetch(`${API_URL}?action=get_data`);
        const result = await response.json();

        if (result.status === 'success') {
            globalData = result.data;
            updateDashboard();
            populateTeamFilter();
            renderTable(globalData, 'all');
            renderTable(globalData, 'team');
        } else {
            showToast('Lỗi khi tải dữ liệu: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Không thể kết nối máy chủ', 'error');
        console.error(error);
    }
    showLoading(false);
}

// Render Dashboard
function updateDashboard() {
    document.getElementById('statTotalProjects').innerText = globalData.length;

    let totalDebt = 0;
    let missingContracts = 0;

    globalData.forEach(row => {
        // Nợ 2026
        const debt = row['Còn phải thanh toán 2026'] || row['Tháng CP 2026'] || 0;
        if (debt && !isNaN(debt.toString().replace(/\./g, ''))) {
            totalDebt += parseInt(debt.toString().replace(/\./g, ''));
        }

        // HĐ Gốc
        const hdGoc = row['Bàn giao hợp đồng gốc'] || '';
        if (hdGoc.toLowerCase().includes('chưa')) {
            missingContracts++;
        }
    });

    document.getElementById('statTotalDebt').innerText = new Intl.NumberFormat('vi-VN').format(totalDebt) + ' đ';
    document.getElementById('statMissingContracts').innerText = missingContracts;
}

// Populate Teams dropdown
function populateTeamFilter() {
    const teams = new Set();
    globalData.forEach(row => {
        if (row['Tổ hạ tầng']) teams.add(row['Tổ hạ tầng']);
    });

    teamFilter.innerHTML = '<option value="">-- Tất cả tổ hạ tầng --</option>';
    teams.forEach(team => {
        teamFilter.innerHTML += `<option value="${team}">${team}</option>`;
    });
}

// Render Table
function renderTable(data, type) {
    const tbody = type === 'all' ? tableAll : tableTeam;
    const searchInput = type === 'all' ? searchInputAll : searchInputTeam;
    const searchTerm = searchInput.value.toLowerCase();

    let filteredData = data.filter(row => {
        const ma = (row['Mã CSHT'] || '').toLowerCase();
        const ten = (row['Tên CSHT'] || '').toLowerCase();
        const dc = (row['Địa chỉ'] || '').toLowerCase();
        return ma.includes(searchTerm) || ten.includes(searchTerm) || dc.includes(searchTerm);
    });

    if (type === 'team') {
        const selectedTeam = teamFilter.value;
        if (selectedTeam) {
            filteredData = filteredData.filter(row => row['Tổ hạ tầng'] === selectedTeam);
        }
    }

    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">Không tìm thấy dữ liệu</td></tr>`;
        return;
    }

    filteredData.forEach((row, index) => {
        const tr = document.createElement('tr');
        const tt = row['Tình trạng hồ sơ'] || 'Chưa rõ';
        let badgeClass = 'default';
        if (tt.toLowerCase().includes('đã thanh toán') || tt.toLowerCase().includes('hoàn thành')) badgeClass = 'success';
        if (tt.toLowerCase().includes('chưa') || tt.toLowerCase().includes('nợ')) badgeClass = 'danger';

        const no2026 = row['Còn phải thanh toán 2026'] || row['Tháng CP 2026'] || 0;

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${row['Mã CSHT'] || ''}</strong></td>
            <td>${row['Tên CSHT'] || ''}</td>
            ${type === 'all' ? `<td>${row['Tổ hạ tầng'] || ''}</td>` : ''}
            <td>${row['Tên chủ nhà/ Tên đơn vị quản lý'] || ''}</td>
            <td style="color: var(--danger-color); font-weight: 600;">${no2026}</td>
            <td><span class="badge ${badgeClass}">${tt}</span></td>
            <td>
                <button class="btn-icon" onclick="editData('${row['Mã CSHT']}')" title="Sửa"><i class="fa-solid fa-pen"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal Functions
function openModal(id = null) {
    dataForm.reset();
    document.getElementById('oldNoteContainer').style.display = 'none';

    if (id) {
        modalTitle.innerText = 'Cập nhật Cơ sở hạ tầng';
        const item = globalData.find(x => x['Mã CSHT'] == id);
        if (item) {
            document.getElementById('field_MaCSHT').value = item['Mã CSHT'] || '';
            document.getElementById('field_MaCSHT').readOnly = true; // Không cho sửa ID

            document.getElementById('field_TenCSHT').value = item['Tên CSHT'] || '';
            document.getElementById('field_ToHaTang').value = item['Tổ hạ tầng'] || '';
            document.getElementById('field_Site').value = item['Site'] || '';
            document.getElementById('field_TenChuNha').value = item['Tên chủ nhà/ Tên đơn vị quản lý'] || '';
            document.getElementById('field_DiaChi').value = item['Địa chỉ'] || '';
            document.getElementById('field_SoHopDong').value = item['Số hợp đồng'] || '';
            document.getElementById('field_ConPhaiThanhToan2026').value = item['Còn phải thanh toán 2026'] || item['Tháng CP 2026'] || '';
            document.getElementById('field_PhanLoai').value = item['Phân loại'] || '';
            document.getElementById('field_TinhTrangHoSo').value = item['Tình trạng hồ sơ'] || '';
            document.getElementById('field_BanGiaoHopDongGoc').value = item['Bàn giao hợp đồng gốc'] || '';

            // Xử lý ghi chú cũ
            const oldNote = item['Ghi chú'] || '';
            if (oldNote) {
                const oldNoteEl = document.getElementById('oldNoteContainer');
                oldNoteEl.innerText = 'Ghi chú cũ:\n' + oldNote;
                oldNoteEl.style.display = 'block';
            }
        }
    } else {
        modalTitle.innerText = 'Thêm mới Cơ sở hạ tầng';
        document.getElementById('field_MaCSHT').readOnly = false;
    }

    formModal.classList.add('active');
}

window.editData = openModal; // Make global

// Save Data
async function saveData() {
    const maCSHT = document.getElementById('field_MaCSHT').value.trim();
    if (!maCSHT) {
        showToast('Mã CSHT không được để trống', 'error');
        return;
    }

    const isUpdate = document.getElementById('field_MaCSHT').readOnly;

    const payload = {
        action: isUpdate ? 'update' : 'create',
        id: isUpdate ? maCSHT : null,
        data: {
            'Mã CSHT': maCSHT,
            'Tên CSHT': document.getElementById('field_TenCSHT').value,
            'Tổ hạ tầng': document.getElementById('field_ToHaTang').value,
            'Site': document.getElementById('field_Site').value,
            'Tên chủ nhà/ Tên đơn vị quản lý': document.getElementById('field_TenChuNha').value,
            'Địa chỉ': document.getElementById('field_DiaChi').value,
            'Số hợp đồng': document.getElementById('field_SoHopDong').value,
            'Còn phải thanh toán 2026': document.getElementById('field_ConPhaiThanhToan2026').value,
            'Phân loại': document.getElementById('field_PhanLoai').value,
            'Tình trạng hồ sơ': document.getElementById('field_TinhTrangHoSo').value,
            'Bàn giao hợp đồng gốc': document.getElementById('field_BanGiaoHopDongGoc').value,
            'Ghi chú': document.getElementById('field_GhiChu').value
        }
    };

    showLoading(true);
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8' // Dùng text/plain để tránh preflight CORS phức tạp trên GAS
            }
        });

        const result = await response.json();

        if (result.status === 'success') {
            showToast(result.data.message || 'Thành công', 'success');
            formModal.classList.remove('active');
            fetchData(); // Reload data
        } else {
            showToast('Lỗi: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Lỗi kết nối khi lưu dữ liệu', 'error');
        console.error(error);
    }
    showLoading(false);
}

// UI Helpers
function showLoading(show) {
    if (show) loadingOverlay.classList.add('active');
    else loadingOverlay.classList.remove('active');
}

function showToast(msg, type = 'success') {
    toast.innerText = msg;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
