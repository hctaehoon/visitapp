document.addEventListener('DOMContentLoaded', function() {
    // 현재 날짜 표시
    const today = new Date();
    document.getElementById('currentDate').textContent = 
        today.toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

    // 검색 기능 추가
    document.getElementById('visitorSearch').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.getElementById('currentVisitorsList').getElementsByTagName('tr');
        
        Array.from(rows).forEach(row => {
            const name = row.cells[1]?.textContent.toLowerCase() || '';
            row.style.display = name.includes(searchTerm) ? '' : 'none';
        });
    });

    // Flatpickr 달력 초기화
    const datePicker = flatpickr("#datePicker", {
        locale: "ko",
        dateFormat: "Y년 m월 d일",
        defaultDate: today,
        onChange: function(selectedDates) {
            const selectedDate = selectedDates[0];
            if (isSameDay(selectedDate, new Date())) {
                loadCurrentVisitors();
            } else {
                loadVisitorsByDate(selectedDate);
            }
        },
        // Flatpickr 추가 옵션
        disableMobile: true,  // 모바일에서 네이티브 달력 사용 안 함
        animate: true,        // 애니메이션 효과
        showMonths: 1,        // 표시할 달력 개수
        nextArrow: '▶',      // 다음 달 화살표
        prevArrow: '◀'       // 이전 달 화살표
    });

    // 초기 데이터 로드
    loadCurrentVisitors();

    // 방문자 등록 폼 제출 처리
    document.getElementById('visitorForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const contact = document.getElementById('contact').value;
        
        // 연락처 유효성 검사
        if (contact && !isValidPhoneNumber(contact)) {
            showErrorModal('핸드폰 번호는 11자리 숫자로 입력해주세요.');
            return;
        }
        
        const formData = {
            company: document.getElementById('company').value,
            name: document.getElementById('name').value,
            position: document.getElementById('position').value,
            contact: contact,
            visit_location: document.getElementById('visit_location').value,
            visit_purpose: document.getElementById('visit_purpose').value,
            manager: document.getElementById('manager').value
        };

        try {
            const checkResponse = await fetch('/api/visitors/check-duplicate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const checkResult = await checkResponse.json();

            if (checkResult.isDuplicate) {
                showDuplicateVisitorModal(checkResult.existingVisitor, formData);
            } else {
                // 일반 등록 처리
                const response = await fetch('/api/visitors', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    showAlertModal();
                    this.reset();
                    loadCurrentVisitors();
                }
            }
        } catch (error) {
            console.error('Error:', error);
            alert('등록 중 오류가 발생했습니다.');
        }
    });

    // CSV 내보내기 버튼 이벤트
    document.getElementById('exportBtn').addEventListener('click', async function() {
        const date = datePicker.selectedDates[0];
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        try {
            const response = await fetch(`/api/export/${year}/${month}`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `방문기록_${year}_${month}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            console.error('Error:', error);
            alert('CSV 내보내기 중 오류가 발생했습니다.');
        }
    });

    // 선택 옵션 초기화
    initializeSelectOptions();
    
    // 업체 추가 기능 설정
    setupCompanyAdd();
    
    // 직접 입력 처리
    setupManualInputs();
    
    // 담당자 검색 기능
    setupManagerSelect();
    
    // 방문자 정보 자동 완성
    setupVisitorAutoComplete();

    // 실시간 시계 시작
    startRealTimeClock();

    loadMissedCheckouts();  // 초기 로드

    // SSE 설정
    setupSSE();
});

async function loadVisitorsByDate(date) {
    try {
        const formattedDate = date.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        
        // 오늘 날짜가 아닌 경우 현재 방문자 목록은 표시하지 않음
        if (formattedDate !== today) {
            document.getElementById('currentVisitorStatus').innerHTML = `
                <div class="no-current-visitors">
                    <p>현재 방문자 현황은 오늘 날짜에서만 확인 가능합니다.</p>
                </div>
            `;
            document.getElementById('currentVisitorCount').textContent = '0';
            
            // SSE 연결 해제
            if (window.eventSource) {
                window.eventSource.close();
            }
        }

        const response = await fetch(`/api/visitors/${formattedDate}`);
        if (!response.ok) {
            throw new Error('Failed to load visitors');
        }
        
        const visitors = await response.json();
        
        // 날짜 표시 업데이트
        document.getElementById('currentDate').textContent = 
            date.toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        
        // 현이블 업데이트
        updateVisitorsTable(visitors, date);
        
        // 오늘 날짜인 경우에만 실시간 업데이트 활성화
        if (formattedDate === today) {
            setupSSE();
        }
    } catch (error) {
        console.error('Error:', error);
        showErrorModal('방문자 목록을 불러오는데 실패했습니다.');
    }
}

async function loadCurrentVisitors() {
    try {
        const response = await fetch('/api/current-visitors');
        const visitors = await response.json();
        
        // 현재 날짜로 헤더 업데이트
        const today = new Date();
        document.getElementById('currentDate').textContent = 
            today.toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        
        updateVisitorsTable(visitors, today);
    } catch (error) {
        console.error('Error:', error);
    }
}

function updateVisitorsTable(visitors, selectedDate = new Date()) {
    const tbody = document.getElementById('currentVisitorsList');
    let html = '';
    
    // 10개의 빈 행 생성
    for(let i = 0; i < 10; i++) {
        if (i < visitors.length) {
            const visitor = visitors[i];
            html += `
                <tr>
                    <td>${visitor[2]}</td>
                    <td>${visitor[3]}</td>
                    <td>${visitor[6]}</td>
                    <td>${visitor[10]}</td>
                    <td>${visitor[8]}</td>
                    <td>${visitor[9] || '-'}</td>
                    <td>
                        ${!visitor[9] && isSameDay(new Date(visitor[1]), new Date()) ? 
                            `<button class="checkout-btn" onclick="checkoutVisitor(${visitor[0]})">퇴실</button>` : 
                            (visitor[9] ? `<button class="completed-btn" disabled>퇴실완료</button>` : '-')}
                    </td>
                </tr>
            `;
        } else {
            html += `
                <tr>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                </tr>
            `;
        }
    }
    
    tbody.innerHTML = html;
    
    // 현재 상태 업데이트 (현재 입실한 방문자만 표시)
    if (isSameDay(selectedDate, new Date())) {
        const currentVisitors = visitors.filter(v => !v[9]);  // 퇴실시간이 없는 방문자만
        updateCurrentVisitorStatus(currentVisitors);
        updateCompanyAnalytics();
        updateVisitPurposeRanking();
    }
}

// 시간 포맷팅 헬퍼 함수 추가
function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes}분`;
    } else if (minutes < 1440) { // 24시간(1440분) 미만
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? 
            `${hours}시간 ${remainingMinutes}분` : 
            `${hours}시간`;
    } else { // 24시간 이상
        const days = Math.floor(minutes / 1440);
        const remainingHours = Math.floor((minutes % 1440) / 60);
        const remainingMinutes = minutes % 60;
        
        let result = `${days}일`;
        if (remainingHours > 0) result += ` ${remainingHours}시간`;
        if (remainingMinutes > 0) result += ` ${remainingMinutes}분`;
        return result;
    }
}

// 현재 방문자 상태 업데이트 함수 수정
function updateCurrentVisitorStatus(currentVisitors) {
    const statusContainer = document.getElementById('currentVisitorStatus');
    document.getElementById('currentVisitorCount').textContent = currentVisitors.length;

    statusContainer.innerHTML = currentVisitors.map(visitor => {
        const checkInTime = new Date(`${new Date().toDateString()} ${visitor[8]}`);
        const duration = Math.floor((new Date() - checkInTime) / (1000 * 60)); // 분 단위

        return `
            <div class="visitor-card">
                <div class="visitor-info">
                    <strong>${visitor[2]}</strong> - 
                    ${visitor[3]}
                    <span class="position">(${visitor[4] || '-'})</span>
                </div>
                <div class="visit-details">
                    <span class="location">${visitor[6]}</span>
                    <span class="duration">체류시간: ${formatDuration(duration)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 업체별 통계 업데이트 함수 수정
async function updateCompanyAnalytics() {
    try {
        const response = await fetch('/api/analytics/companies');
        const companies = await response.json();
        
        const analyticsContainer = document.getElementById('companyAnalytics');
        analyticsContainer.innerHTML = companies.map(company => {
            const totalMinutes = company[3] ? Math.round(company[3] / 60) : 0;
            
            // 최장 체류 시간 계산
            const longestMinutes = company[6] ? Math.round(company[6] / 60) : 0;
            
            const longestVisitorInfo = company[4] ? `
                <div class="longest-visitor">
                    <div class="visitor-name">최장 체류: ${company[4]} ${company[5] ? `(${company[5]})` : ''}</div>
                    <div class="visitor-duration">(${formatDuration(longestMinutes)})</div>
                </div>
            ` : '';
            
            return `
                <div class="analytics-card">
                    <div class="company-name">${company[0]}</div>
                    <div class="visit-count">총 방문: ${company[1]}회</div>
                    <div class="current-visitors">현재 방문: ${company[2] || 0}명</div>
                    <div class="total-duration">누적 체류: ${formatDuration(totalMinutes)}</div>
                    ${longestVisitorInfo}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateVisitPurposeRanking() {
    try {
        const response = await fetch('/api/analytics/purposes');
        const purposes = await response.json();
        
        const rankingHtml = `
            <div class="purpose-ranking">
                <h3>방문 목적</h3>
                <div class="ranking-list">
                    ${purposes.map((purpose, index) => `
                        <div class="ranking-item">
                            <span class="rank">${index + 1}</span>
                            <span class="purpose">${purpose[0]}</span>
                            <span class="count">${purpose[1]}회</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const calendarSection = document.querySelector('.calendar-section');
        const existingRanking = calendarSection.querySelector('.purpose-ranking');
        if (existingRanking) {
            existingRanking.remove();
        }
        calendarSection.insertAdjacentHTML('beforeend', rankingHtml);
    } catch (error) {
        console.error('Error:', error);
    }
}

// 전역 변수로 현재 처리 중인 방문자 ID 저장
let currentCheckoutId = null;

// checkoutVisitor 함수 수정
async function checkoutVisitor(visitorId) {
    currentCheckoutId = visitorId;
    const modal = document.getElementById('checkoutConfirmModal');
    modal.style.display = 'block';
}

// 퇴실 확인 처리 함수
async function confirmCheckout() {
    if (!currentCheckoutId) return;
    
    try {
        const response = await fetch(`/api/visitors/${currentCheckoutId}/checkout`, {
            method: 'POST'
        });

        if (response.ok) {
            // 확인 모달 닫기
            closeModal('checkoutConfirmModal');
            
            // 완료 모달 표시
            const completeModal = document.getElementById('checkoutCompleteModal');
            completeModal.style.display = 'block';
            
            // 2초 후 완료 모달 닫기
            setTimeout(() => {
                completeModal.style.display = 'none';
            }, 2000);

            // 현재 방문자 목록 새고침
            loadCurrentVisitors();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('퇴실 처리 중 오류가 발생했습니다.');
    } finally {
        currentCheckoutId = null;
    }
}

// 모달 닫기 함수 수정
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
    if (modalId === 'checkoutConfirmModal') {
        currentCheckoutId = null;
    }
}

// 날짜 비교 헬퍼 함수 추가
function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// 선택 옵션 초기화 함수
async function initializeSelectOptions() {
    try {
        // 업체명 옵션 로드
        const companies = await fetch('/api/options/companies').then(r => r.json());
        const companySelect = document.getElementById('company');
        companies.forEach(company => {
            const option = new Option(company, company);
            companySelect.add(option);
        });

        // 직급 옵션 로드
        const positions = await fetch('/api/options/positions').then(r => r.json());
        const positionSelect = document.getElementById('position');
        positions.forEach(position => {
            const option = new Option(position, position);
            positionSelect.add(option);
        });

        // 방문장소 옵션 로드
        const locations = await fetch('/api/options/locations').then(r => r.json());
        const locationSelect = document.getElementById('visit_location');
        locations.forEach(location => {
            const option = new Option(location, location);
            locationSelect.add(option);
        });

        // 방문목적 옵션 로드
        const purposes = await fetch('/api/options/purposes').then(r => r.json());
        const purposeSelect = document.getElementById('visit_purpose');
        purposes.forEach(purpose => {
            const option = new Option(purpose, purpose);
            purposeSelect.add(option);
        });
    } catch (error) {
        console.error('Error loading options:', error);
    }
}

// 접 입력 처리 설정
function setupManualInputs() {
    const inputPairs = [
        { select: 'position', input: 'positionInput' },
        { select: 'visit_location', input: 'locationInput' },
        { select: 'visit_purpose', input: 'purposeInput' }
    ];

    inputPairs.forEach(pair => {
        const select = document.getElementById(pair.select);
        const input = document.getElementById(pair.input);
        const container = select.parentElement;

        // 직접 입력 버튼 추가
        const manualButton = document.createElement('button');
        manualButton.type = 'button';
        manualButton.className = 'manual-input-btn';
        manualButton.textContent = '직접 입력';
        container.appendChild(manualButton);

        // 목록 선택 버튼 추가
        const listButton = document.createElement('button');
        listButton.type = 'button';
        listButton.className = 'list-select-btn';
        listButton.textContent = '목록에서 선택';
        listButton.style.display = 'none';
        container.appendChild(listButton);

        // 직접 입력 드로 전환
        manualButton.addEventListener('click', function() {
            select.style.display = 'none';
            input.style.display = 'block';
            input.required = true;
            select.required = false;
            input.value = '';
            input.focus();
            manualButton.style.display = 'none';
            listButton.style.display = 'block';
        });

        // 목록 선택 모드로 전환
        listButton.addEventListener('click', function() {
            input.style.display = 'none';
            select.style.display = 'block';
            select.required = true;
            input.required = false;
            select.value = '';
            listButton.style.display = 'none';
            manualButton.style.display = 'block';
        });
    });
}

// 담당자 검색 설정
function setupManagerSelect() {
    const departmentSelect = document.getElementById('department');
    const managerSelect = document.getElementById('manager');

    async function loadDepartments() {
        try {
            const response = await fetch('/api/options/departments');
            const departments = await response.json();
            console.log("Received departments:", departments);  // 받은 부서 데이터 확인
            
            departmentSelect.innerHTML = '<option value="">부서 선택</option>';
            
            departments.forEach(([id, name]) => {
                console.log(`Adding department: id=${id}, name=${name}`);  // 각 부서 추가 확인
                const option = new Option(name, id);
                departmentSelect.add(option);
            });
        } catch (error) {
            console.error('Error loading departments:', error);
        }
    }

    departmentSelect.addEventListener('change', async function() {
        const selectedId = this.value;
        console.log("Selected department ID:", selectedId);  // 선택된 부서 ID 확인
        
        managerSelect.innerHTML = '<option value="">담당자 선택</option>';
        
        if (!selectedId) return;

        try {
            const response = await fetch(`/api/managers/department/${selectedId}`);
            const managers = await response.json();
            console.log("Received managers:", managers);  // 받은 담당자 데이터 확인
            
            managers.forEach(([name, position]) => {
                const option = new Option(`${name} ${position}`, `${name} ${position}`);
                managerSelect.add(option);
            });
        } catch (error) {
            console.error('Error loading managers:', error);
        }
    });

    loadDepartments();
}

// 방문자 정보 자동 완성 설정
function setupVisitorAutoComplete() {
    const companyInput = document.getElementById('company');
    const nameInput = document.getElementById('name');
    const positionInput = document.getElementById('position');
    const contactInput = document.getElementById('contact');

    async function checkVisitorHistory() {
        const company = companyInput.value;
        const name = nameInput.value;

        if (company && name) {
            try {
                const response = await fetch(`/api/visitor-history?company=${encodeURIComponent(company)}&name=${encodeURIComponent(name)}`);
                const history = await response.json();

                if (history) {
                    console.log("Found visitor history:", history);
                    if (history[0]) positionInput.value = history[0];
                    if (history[1]) {
                        contactInput.value = history[1];
                        contactInput.classList.add('auto-filled');
                        setTimeout(() => contactInput.classList.remove('auto-filled'), 1000);
                    }
                }
            } catch (error) {
                console.error('Error fetching visitor history:', error);
            }
        }
    }

    // 업체명 변경 시 체크
    companyInput.addEventListener('change', checkVisitorHistory);
    
    // 이름 입력 후 포커스 잃을 때 체크
    nameInput.addEventListener('blur', checkVisitorHistory);
    
    // 이름 입력 중에도 체크 (선택적)
    nameInput.addEventListener('input', debounce(checkVisitorHistory, 500));
}

// 디바운스 함수
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 모달 관련 함수 추가
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

// setupManualInputs 함수를 setupCompanyAdd로 변경
function setupCompanyAdd() {
    const companySelect = document.getElementById('company');
    const addCompanyForm = document.getElementById('addCompanyForm');

    companySelect.addEventListener('change', function() {
        if (this.value === 'add') {
            openModal('addCompanyModal');
            this.value = ''; // select 값 초기화
        }
    });

    // 새 업체 추가 처리
    addCompanyForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const newCompanyName = document.getElementById('newCompanyName').value.trim();

        try {
            const response = await fetch('/api/options/companies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: newCompanyName })
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.message);
                
                // 업체 목록 새로고침
                const companies = await fetch('/api/options/companies').then(r => r.json());
                const companySelect = document.getElementById('company');
                
                // 기존 옵션 제거 (첫 번째와 마지막 옵션 제외)
                while (companySelect.options.length > 2) {
                    companySelect.remove(1);
                }
                
                // 새 옵션 추가 (마지막 옵션 앞에 삽입)
                companies.forEach(company => {
                    const option = new Option(company, company);
                    companySelect.add(option, companySelect.options[companySelect.options.length - 1]);
                });

                // 새로 추가된 업체 선택
                companySelect.value = newCompanyName;
                
                closeModal('addCompanyModal');
                addCompanyForm.reset();
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('업체 추가 중 오류가 발생했습니다.');
        }
    });

    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', function(e) {
        if (e.target.className === 'modal') {
            closeModal('addCompanyModal');
            companySelect.value = '';
        }
    });
}

// 실시간 시계 함수 추가
function startRealTimeClock() {
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        });
        document.getElementById('currentTime').textContent = timeString;
    }

    // 초기 실행
    updateClock();
    // 1초마다 업데이트
    setInterval(updateClock, 1000);
}

// 알림 모달 함수 추가
function showAlertModal() {
    const modal = document.getElementById('alertModal');
    modal.style.display = 'block';
    
    // 2초 후 자동으로 닫기
    setTimeout(() => {
        modal.style.display = 'none';
    }, 2000);
}

// 에러 알림 모달 함수 추가
function showErrorModal(message) {
    const modal = document.getElementById('errorModal');
    const messageElement = modal.querySelector('.error-message');
    messageElement.textContent = message;
    modal.style.display = 'block';
    
    // 2초 후 자동으로 닫기
    setTimeout(() => {
        modal.style.display = 'none';
    }, 2000);
}

// 전역 변수로 현재 처리 중인 방문자 정보 저장
let pendingVisitorData = null;
let duplicateVisitorId = null;

// 이중 입실 처리 함수 수정
function showDuplicateVisitorModal(existingVisitor, newVisitorData) {
    const modal = document.getElementById('duplicateVisitorModal');
    const lastCheckInTime = document.getElementById('lastCheckInTime');
    const reasonSelect = document.getElementById('duplicateReason');
    const customReason = document.getElementById('customReason');

    // 방문자 정보 저장
    pendingVisitorData = newVisitorData;
    duplicateVisitorId = existingVisitor.id;

    // 마지막 입실 시간 표시
    lastCheckInTime.textContent = existingVisitor.check_in_time;

    // 초기화
    reasonSelect.value = '';
    customReason.value = '';
    customReason.style.display = 'none';

    // 사유 선택 이벤트 처리
    reasonSelect.onchange = function() {
        customReason.style.display = this.value === 'custom' ? 'block' : 'none';
        if (this.value !== 'custom') {
            customReason.value = '';
        }
    };

    modal.style.display = 'block';
}

// 퇴실 누락 목록 로드 함수 추가
async function loadMissedCheckouts() {
    try {
        const response = await fetch('/api/missed-checkouts');
        const missedCheckouts = await response.json();
        
        const tbody = document.getElementById('missedCheckoutsList');
        tbody.innerHTML = missedCheckouts.map(checkout => `
            <tr>
                <td>${checkout[1]}</td>
                <td>${checkout[2]}</td>
                <td>${checkout[4]}</td>
                <td>${checkout[6]}</td>
                <td>${checkout[5]}</td>
                <td>${checkout[7]}</td>
                <td>${checkout[8]}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading missed checkouts:', error);
    }
}

// handleDuplicateVisitor 함수 수정
async function handleDuplicateVisitor() {
    const reasonSelect = document.getElementById('duplicateReason');
    const customReason = document.getElementById('customReason');
    
    if (!reasonSelect.value) {
        showErrorModal('재입실 사유를 선택해주세요.');
        return;
    }

    if (reasonSelect.value === 'custom' && !customReason.value.trim()) {
        showErrorModal('재입실 사유를 입력해주세요.');
        return;
    }

    const reason = reasonSelect.value === 'custom' ? customReason.value : '퇴실 누락';
    
    try {
        if (!duplicateVisitorId) {
            throw new Error('방문자 ID가 없습니다.');
        }

        // 기존 방문자 퇴실 처리 및 누락 기록
        const missedResponse = await fetch(`/api/visitors/${duplicateVisitorId}/missed-checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                original_date: new Date().toISOString().split('T')[0],
                reason: reason
            })
        });

        if (!missedResponse.ok) {
            throw new Error('퇴실 누락 처리 중 오류가 발생했습니다.');
        }

        // pendingVisitorData 확인
        if (!pendingVisitorData) {
            throw new Error('방문자 데이터가 없습니다.');
        }

        // 새로운 방문자 등록
        const response = await fetch('/api/visitors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(pendingVisitorData)
        });

        const result = await response.json();

        if (response.ok) {
            // 모달 닫기
            closeModal('duplicateVisitorModal');
            
            // 성공 알림 표시
            showAlertModal();
            
            // 폼 초기화
            document.getElementById('visitorForm').reset();
            
            // 목록 새로고침
            await loadCurrentVisitors();
            
            // 입력 필드 초기화
            reasonSelect.value = '';
            customReason.value = '';
            customReason.style.display = 'none';
        } else {
            showErrorModal(result.message || '등록 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('Error:', error);
        showErrorModal(error.message || '처리 중 오류가 발생했습니다.');
    } finally {
        // 전역 변수 초기화
        pendingVisitorData = null;
        duplicateVisitorId = null;
    }
}

// CSV 버튼 텍스트 수정
document.getElementById('exportBtn').innerHTML = `
    <i class="download-icon">📥</i>
    Excel 저장
`;

// SSE 설정 함수 수정
function setupSSE() {
    if (window.eventSource) {
        window.eventSource.close();
    }
    
    window.eventSource = new EventSource('/api/sse');
    
    window.eventSource.onmessage = function(event) {
        const visitors = JSON.parse(event.data);
        debouncedUpdate(visitors);
    };

    window.eventSource.onerror = function(error) {
        console.error('SSE Error:', error);
        window.eventSource.close();
        
        // 3초 후 재연결 시도
        setTimeout(setupSSE, 3000);
    };
}

// SSE 메시지 처리에 디바운싱 적용
const debouncedUpdate = debounce((visitors) => {
    updateVisitorsTable(visitors, new Date());
}, 300);  // 300ms 디바운스

// 핸드폰 번호 유효성 검사 함수
function isValidPhoneNumber(phone) {
    const phoneRegex = /^01[0-9]{9}$/;  // 010, 011, 016, 017, 018, 019로 시작하는 11자리 숫자
    return phoneRegex.test(phone);
}

// 연락처 입력 필드 이벤트 리스너
document.getElementById('contact').addEventListener('input', function(e) {
    // 숫자만 입력 가능하도록
    this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11);
    
    // 입력 값이 있을 때만 유효성 검사
    if (this.value && !isValidPhoneNumber(this.value)) {
        this.setCustomValidity('핸드폰 번호는 11자리 숫자로 입력해주세요.');
        this.style.borderColor = 'var(--danger)';
    } else {
        this.setCustomValidity('');
        this.style.borderColor = '';
    }
});
