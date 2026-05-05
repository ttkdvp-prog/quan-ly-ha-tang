// Thay URL này bằng link Web App sau khi deploy GAS
const API_URL = 'https://script.google.com/macros/s/AKfycbxMEsirWB11sN-l8VdJK6b9OtyrgmE7oJ91v_ijcPGcIORQLClNIkVWEzDQR6cR77x5/exec'; // Placeholder

let globalData = [];
let globalHistory = [];

// Pagination State
const ROWS_PER_PAGE = 20;
let currentPageAll = 1;
let currentPageTeam = 1;
let currentPageHistory = 1;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const closeSidebar = document.getElementById('closeSidebar');
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('pageTitle');

const tableAll = document.getElementById('tbodyAll');
const tableTeam = document.getElementById('tbodyTeam');
const tableHistory = document.getElementById('tbodyHistory');
const teamFilter = document.getElementById('teamFilter');
const searchInputAll = document.getElementById('searchInputAll');
const searchInputTeam = document.getElementById('searchInputTeam');
const searchInputHistory = document.getElementById('searchInputHistory');

const formModal = document.getElementById('formModal');
const btnAddNew = document.getElementById('btnAddNew');
const closeModal = document.getElementById('closeModal');
const btnCancel = document.getElementById('btnCancel');
const btnSave = document.getElementById('btnSave');
const dataForm = document.getElementById('dataForm');
const modalTitle = document.getElementById('modalTitle');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const btnRefresh = document.getElementById('btnRefresh');

// Helper: Format Currency
function formatCurrency(val) {
    if (val === undefined || val === null || val === '') return '';
    let numStr = String(val).replace(/[^\d-]/g, '');
    if (!numStr) return val;
    let num = parseInt(numStr, 10);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('vi-VN').format(num);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    handleRoute(); // Xử lý routing khi vừa load trang
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

    // Navigation handled by hashchange
    window.addEventListener('hashchange', handleRoute);
    
    // Close sidebar on mobile when a nav item is clicked
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 992) sidebar.classList.remove('active');
        });
    });

    // Search & Filter
    searchInputAll.addEventListener('input', () => { currentPageAll = 1; renderTable(globalData, 'all'); });
    searchInputTeam.addEventListener('input', () => { currentPageTeam = 1; renderTable(globalData, 'team'); });
    searchInputHistory.addEventListener('input', () => { currentPageHistory = 1; renderHistoryTable(globalHistory); });
    teamFilter.addEventListener('change', () => { currentPageTeam = 1; renderTable(globalData, 'team'); });

    // Refresh Button
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => fetchData());
    }

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

// Router Logic
function handleRoute() {
    let hash = window.location.hash.replace('#/', '') || 'dashboard';
    
    // Nếu hash không tồn tại trong danh sách page hợp lệ, đưa về dashboard
    const validPages = ['dashboard', 'list-all', 'list-team', 'history'];
    if (!validPages.includes(hash)) {
        hash = 'dashboard';
        window.location.hash = '#/dashboard';
        return;
    }

    navItems.forEach(n => n.classList.remove('active'));
    const activeNavItem = document.querySelector(`[data-page="${hash}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
        pageTitle.innerText = activeNavItem.innerText.trim();
    }

    pages.forEach(p => p.classList.remove('active'));
    const activePage = document.getElementById(`page-${hash}`);
    if (activePage) activePage.classList.add('active');
}

// Fetch Data
async function fetchData() {
    showLoading(true);
    try {
        const response = await fetch(`${API_URL}?action=get_data`);
        const result = await response.json();

        if (result.status === 'success') {
            globalData = result.data;
            globalHistory = result.history || [];
            updateDashboard();
            populateTeamFilter();
            renderTable(globalData, 'all');
            renderTable(globalData, 'team');
            renderHistoryTable(globalHistory);
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
        const hdGoc = String(row['Bàn giao hợp đồng gốc'] || '');
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
        const ma = String(row['Mã CSHT'] || '').toLowerCase();
        const ten = String(row['Tên CSHT'] || '').toLowerCase();
        const dc = String(row['Địa chỉ'] || '').toLowerCase();
        return ma.includes(searchTerm) || ten.includes(searchTerm) || dc.includes(searchTerm);
    });

    if (type === 'team') {
        const selectedTeam = teamFilter.value;
        if (selectedTeam) {
            filteredData = filteredData.filter(row => row['Tổ hạ tầng'] === selectedTeam);
        }
    }

    tbody.innerHTML = '';

    // Pagination
    const currentPage = type === 'all' ? currentPageAll : currentPageTeam;
    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, startIndex + ROWS_PER_PAGE);

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">Không tìm thấy dữ liệu</td></tr>`;
        renderPagination(0, type);
        return;
    }

    paginatedData.forEach((row, idx) => {
        const index = startIndex + idx;
        const tr = document.createElement('tr');
        const tt = String(row['Tình trạng hồ sơ'] || 'Chưa rõ');
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
            <td style="color: var(--danger-color); font-weight: 600;">${formatCurrency(no2026)}</td>
            <td><span class="badge ${badgeClass}">${tt}</span></td>
            <td><div style="max-width: 200px; max-height: 80px; overflow-y: auto; font-size: 12px; white-space: pre-wrap; color: #555;">${row['Ghi chú'] || ''}</div></td>
            <td>
                <button class="btn-icon" onclick="editData('${row['Mã CSHT']}')" title="Sửa"><i class="fa-solid fa-pen"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(filteredData.length, type);
}

// Render History Table
function renderHistoryTable(data) {
    const searchTerm = searchInputHistory.value.toLowerCase();
    
    let filteredData = data.filter(row => {
        const ma = String(row['Mã CSHT'] || '').toLowerCase();
        const ten = String(row['Tên CSHT'] || '').toLowerCase();
        const hanhDong = String(row['Hành động'] || '').toLowerCase();
        return ma.includes(searchTerm) || ten.includes(searchTerm) || hanhDong.includes(searchTerm);
    });

    // Pagination
    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const startIndex = (currentPageHistory - 1) * ROWS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, startIndex + ROWS_PER_PAGE);

    tableHistory.innerHTML = '';
    
    if (filteredData.length === 0) {
        tableHistory.innerHTML = `<tr><td colspan="9" style="text-align: center;">Không tìm thấy lịch sử nào</td></tr>`;
        renderPagination(0, 'history');
        return;
    }

    paginatedData.forEach((row) => {
        const tr = document.createElement('tr');
        
        // Màu sắc cho Hành động
        const action = String(row['Hành động'] || '');
        let actionBadge = 'default';
        if(action.includes('Thêm')) actionBadge = 'success';
        if(action.includes('Cập nhật')) actionBadge = 'warning';
        if(action.includes('Xóa')) actionBadge = 'danger';

        tr.innerHTML = `
            <td style="white-space: nowrap; font-size: 13px;">${row['Thời gian'] || row['Thời gian sửa'] || ''}</td>
            <td>${row['Tổ hạ tầng'] || ''}</td>
            <td><span class="badge ${actionBadge}">${action}</span></td>
            <td><strong>${row['Mã CSHT'] || ''}</strong></td>
            <td>${row['Tên CSHT'] || ''}</td>
            <td style="color: var(--danger-color);">${formatCurrency(row['Công nợ 2026'])}</td>
            <td>${row['Tình trạng hồ sơ'] || ''}</td>
            <td>${row['Phân loại'] || ''}</td>
            <td><div style="max-width: 250px; max-height: 80px; overflow-y: auto; font-size: 12px; white-space: pre-wrap; color: #555;">${row['Ghi chú'] || ''}</div></td>
        `;
        tableHistory.appendChild(tr);
    });
    
    renderPagination(filteredData.length, 'history');
}

// Render Pagination Controls
function renderPagination(totalItems, type) {
    const totalPages = Math.ceil(totalItems / ROWS_PER_PAGE);
    let paginationContainer;
    let currentPage;

    if (type === 'all') {
        paginationContainer = document.getElementById('paginationAll');
        currentPage = currentPageAll;
    } else if (type === 'team') {
        paginationContainer = document.getElementById('paginationTeam');
        currentPage = currentPageTeam;
    } else {
        paginationContainer = document.getElementById('paginationHistory');
        currentPage = currentPageHistory;
    }

    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    // Prev Button
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(currentPage - 1, type);
    paginationContainer.appendChild(prevBtn);

    // Page Numbers
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.innerText = '1';
        firstBtn.onclick = () => changePage(1, type);
        paginationContainer.appendChild(firstBtn);
        if (startPage > 2) {
            const ellipsis = document.createElement('button');
            ellipsis.innerText = '...';
            ellipsis.disabled = true;
            paginationContainer.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.innerText = i;
        if (i === currentPage) pageBtn.classList.add('active');
        pageBtn.onclick = () => changePage(i, type);
        paginationContainer.appendChild(pageBtn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('button');
            ellipsis.innerText = '...';
            ellipsis.disabled = true;
            paginationContainer.appendChild(ellipsis);
        }
        const lastBtn = document.createElement('button');
        lastBtn.innerText = totalPages;
        lastBtn.onclick = () => changePage(totalPages, type);
        paginationContainer.appendChild(lastBtn);
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1, type);
    paginationContainer.appendChild(nextBtn);
}

function changePage(newPage, type) {
    if (type === 'all') {
        currentPageAll = newPage;
        renderTable(globalData, 'all');
    } else if (type === 'team') {
        currentPageTeam = newPage;
        renderTable(globalData, 'team');
    } else {
        currentPageHistory = newPage;
        renderHistoryTable(globalHistory);
    }
}

// Modal Functions
function openModal(id = null) {
    dataForm.reset();
    document.getElementById('oldNoteContainer').style.display = 'none';

    if (id) {
        modalTitle.innerText = 'Cập nhật Cơ sở hạ tầng';
        const item = globalData.find(x => x['Mã CSHT'] == id);
        if (item) {
            document.getElementById('field_SoTT').value = item['Số TT'] || '';
            document.getElementById('field_MaCSHT').value = item['Mã CSHT'] || '';
            document.getElementById('field_TenCSHT').value = item['Tên CSHT'] || '';
            document.getElementById('field_Site').value = item['Site'] || '';
            document.getElementById('field_ToHaTang').value = item['Tổ hạ tầng'] || '';
            document.getElementById('field_PhanLoai').value = item['Phân loại'] || '';
            document.getElementById('field_TenChuNha').value = item['Tên chủ nhà/ Tên đơn vị quản lý'] || '';
            document.getElementById('field_TenChuNhaMoi').value = item['Tên chủ nhà/đơn vị mới'] || '';
            document.getElementById('field_SoDienThoai').value = item['Số điện thoại liên hệ'] || '';
            document.getElementById('field_DiaChi').value = item['Địa chỉ'] || '';
            document.getElementById('field_DVQLTruocBanGiao').value = item['Đơn vị quản lý trước bàn giao'] || '';
            document.getElementById('field_SoHopDong').value = item['Số hợp đồng'] || '';
            document.getElementById('field_NgayHieuLuc').value = item['Ngày hiệu lực'] || '';
            document.getElementById('field_ThoiHanThue').value = item['Thời hạn thuê (năm)'] || '';
            document.getElementById('field_NgayDaoHan').value = item['Ngày đáo hạn HĐ'] || '';
            document.getElementById('field_TinhTrangHoSo').value = item['Tình trạng hồ sơ'] || '';
            document.getElementById('field_BanGiaoHopDongGoc').value = item['Bàn giao hợp đồng gốc'] || '';
            document.getElementById('field_FileHDCu').value = item['File hợp đồng cũ'] || '';
            document.getElementById('field_FileHDMoi').value = item['File hợp đồng mới'] || '';
            document.getElementById('field_VuongMac').value = item['Vướng mắc khi ký hợp đồng'] || '';
            document.getElementById('field_DonGia2025').value = item['Đơn giá 2025 (chưa VAT)'] || '';
            document.getElementById('field_TongTien2025').value = item['Tổng tiền năm 2025'] || '';
            document.getElementById('field_Tong2025DaTra').value = item['Tổng 2025 đã trả'] || '';
            document.getElementById('field_TongPhaiTra2025').value = item['Tổng phải trả còn lại 2025 (nhận bàn giao về)'] || '';
            document.getElementById('field_CongNo2025XinYKien').value = item['Công nợ 2025 còn phải trả đang xin ý kiến VTT'] || '';
            document.getElementById('field_CanNo2025').value = item['Cấn nợ CN 2025 tới 15/4/2026'] || '';
            document.getElementById('field_TangGia').value = item['Tăng giá'] || '';
            document.getElementById('field_GiaMoiDeNghiTang').value = item['Giá mới đề nghị tăng'] || '';
            document.getElementById('field_DonGia2026').value = item['Đơn giá 2026 (chưa VAT)'] || '';
            document.getElementById('field_ThangCP2026').value = item['Tháng CP 2026'] || '';
            document.getElementById('field_DaThanhToan2026_T3').value = item['đã thanh toán 2026 đến 31/3/2026'] || '';
            document.getElementById('field_DaThanhToan_1_10').value = item['đã thanh toán từ 1/10 đến nay'] || '';
            document.getElementById('field_ConPhaiThanhToan2026').value = item['Còn phải thanh toán 2026'] || '';
            document.getElementById('field_ThanhToanT4').value = item['Thanh toán tháng 4.2026'] || '';
            document.getElementById('field_ThanhToanT5').value = item['Thanh toán tháng 5.2026'] || '';
            document.getElementById('field_ThanhToanT6').value = item['Thanh toán tháng 6.2026'] || '';
            document.getElementById('field_ThanhToanT7').value = item['Thanh toán tháng 7.2026'] || '';
            document.getElementById('field_ThanhToanT8').value = item['Thanh toán tháng 8.2026'] || '';
            document.getElementById('field_ThanhToanT9').value = item['Thanh toán tháng 9.2026'] || '';
            document.getElementById('field_ThanhToanT10').value = item['Thanh toán tháng 10.2026'] || '';
            document.getElementById('field_ThanhToanT11').value = item['Thanh toán tháng 11.2026'] || '';
            document.getElementById('field_ThanhToanT12').value = item['Thanh toán tháng 12.2026'] || '';

            // Đưa thẳng Ghi chú cũ vào textarea để người dùng dễ dàng chỉnh sửa hoặc nối tiếp
            document.getElementById('field_GhiChu').value = item['Ghi chú'] || '';
            document.getElementById('oldNoteContainer').style.display = 'none';
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
            'Số TT': document.getElementById('field_SoTT').value,
            'Mã CSHT': maCSHT,
            'Tên CSHT': document.getElementById('field_TenCSHT').value,
            'Site': document.getElementById('field_Site').value,
            'Tổ hạ tầng': document.getElementById('field_ToHaTang').value,
            'Phân loại': document.getElementById('field_PhanLoai').value,
            'Tên chủ nhà/ Tên đơn vị quản lý': document.getElementById('field_TenChuNha').value,
            'Tên chủ nhà/đơn vị mới': document.getElementById('field_TenChuNhaMoi').value,
            'Số điện thoại liên hệ': document.getElementById('field_SoDienThoai').value,
            'Địa chỉ': document.getElementById('field_DiaChi').value,
            'Đơn vị quản lý trước bàn giao': document.getElementById('field_DVQLTruocBanGiao').value,
            'Số hợp đồng': document.getElementById('field_SoHopDong').value,
            'Ngày hiệu lực': document.getElementById('field_NgayHieuLuc').value,
            'Thời hạn thuê (năm)': document.getElementById('field_ThoiHanThue').value,
            'Ngày đáo hạn HĐ': document.getElementById('field_NgayDaoHan').value,
            'Tình trạng hồ sơ': document.getElementById('field_TinhTrangHoSo').value,
            'Bàn giao hợp đồng gốc': document.getElementById('field_BanGiaoHopDongGoc').value,
            'File hợp đồng cũ': document.getElementById('field_FileHDCu').value,
            'File hợp đồng mới': document.getElementById('field_FileHDMoi').value,
            'Vướng mắc khi ký hợp đồng': document.getElementById('field_VuongMac').value,
            'Đơn giá 2025 (chưa VAT)': document.getElementById('field_DonGia2025').value,
            'Tổng tiền năm 2025': document.getElementById('field_TongTien2025').value,
            'Tổng 2025 đã trả': document.getElementById('field_Tong2025DaTra').value,
            'Tổng phải trả còn lại 2025 (nhận bàn giao về)': document.getElementById('field_TongPhaiTra2025').value,
            'Công nợ 2025 còn phải trả đang xin ý kiến VTT': document.getElementById('field_CongNo2025XinYKien').value,
            'Cấn nợ CN 2025 tới 15/4/2026': document.getElementById('field_CanNo2025').value,
            'Tăng giá': document.getElementById('field_TangGia').value,
            'Giá mới đề nghị tăng': document.getElementById('field_GiaMoiDeNghiTang').value,
            'Đơn giá 2026 (chưa VAT)': document.getElementById('field_DonGia2026').value,
            'Tháng CP 2026': document.getElementById('field_ThangCP2026').value,
            'đã thanh toán 2026 đến 31/3/2026': document.getElementById('field_DaThanhToan2026_T3').value,
            'đã thanh toán từ 1/10 đến nay': document.getElementById('field_DaThanhToan_1_10').value,
            'Còn phải thanh toán 2026': document.getElementById('field_ConPhaiThanhToan2026').value,
            'Thanh toán tháng 4.2026': document.getElementById('field_ThanhToanT4').value,
            'Thanh toán tháng 5.2026': document.getElementById('field_ThanhToanT5').value,
            'Thanh toán tháng 6.2026': document.getElementById('field_ThanhToanT6').value,
            'Thanh toán tháng 7.2026': document.getElementById('field_ThanhToanT7').value,
            'Thanh toán tháng 8.2026': document.getElementById('field_ThanhToanT8').value,
            'Thanh toán tháng 9.2026': document.getElementById('field_ThanhToanT9').value,
            'Thanh toán tháng 10.2026': document.getElementById('field_ThanhToanT10').value,
            'Thanh toán tháng 11.2026': document.getElementById('field_ThanhToanT11').value,
            'Thanh toán tháng 12.2026': document.getElementById('field_ThanhToanT12').value,
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
