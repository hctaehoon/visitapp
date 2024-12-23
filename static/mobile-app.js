document.addEventListener('DOMContentLoaded', function() {
    // 초기 데이터 로드
    initializeSelectOptions();
    setupManagerSelect();

    // 방문자 등록 폼 제출 처리
    document.getElementById('mobileVisitorForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            company: document.getElementById('company').value,
            name: document.getElementById('name').value,
            position: document.getElementById('position').value,
            contact: document.getElementById('contact').value,
            visit_location: document.getElementById('visit_location').value,
            visit_purpose: document.getElementById('visit_purpose').value,
            manager: document.getElementById('manager').value
        };

        try {
            const response = await fetch('/api/visitors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                alert('방문자 등록이 완료되었습니다.');
                this.reset();
            } else {
                alert(result.message || '등록 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('등록 중 오류가 발생했습니다.');
        }
    });
});

// 선택 옵션 초기화
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

// 담당자 선택 설정
function setupManagerSelect() {
    const departmentSelect = document.getElementById('department');
    const managerSelect = document.getElementById('manager');

    async function loadDepartments() {
        try {
            const response = await fetch('/api/options/departments');
            const departments = await response.json();
            
            departmentSelect.innerHTML = '<option value="">부서 선택</option>';
            
            departments.forEach(([id, name]) => {
                const option = new Option(name, id);
                departmentSelect.add(option);
            });
        } catch (error) {
            console.error('Error loading departments:', error);
        }
    }

    departmentSelect.addEventListener('change', async function() {
        const selectedId = this.value;
        managerSelect.innerHTML = '<option value="">담당자 선택</option>';
        
        if (!selectedId) return;

        try {
            const response = await fetch(`/api/managers/department/${selectedId}`);
            const managers = await response.json();
            
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