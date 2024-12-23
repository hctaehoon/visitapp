import sqlite3
from datetime import datetime, timedelta

class VisitorDB:
    def __init__(self):
        self.db_path = 'visitor_log.db'
        self.create_tables()

    def get_connection(self):
        return sqlite3.connect(self.db_path)

    def create_tables(self):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS visitors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    company TEXT NOT NULL,
                    name TEXT NOT NULL,
                    position TEXT,
                    contact TEXT,
                    visit_location TEXT NOT NULL,
                    visit_purpose TEXT NOT NULL,
                    check_in_time TEXT NOT NULL,
                    check_out_time TEXT,
                    manager TEXT NOT NULL,
                    status TEXT DEFAULT 'NORMAL'  -- 'NORMAL' 또는 'MISSED'
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS companies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    selection_count INTEGER DEFAULT 0
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS positions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    selection_count INTEGER DEFAULT 0
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS locations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    selection_count INTEGER DEFAULT 0
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS departments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS managers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    department_id INTEGER,
                    name TEXT NOT NULL,
                    position TEXT NOT NULL,
                    selection_count INTEGER DEFAULT 0,
                    FOREIGN KEY (department_id) REFERENCES departments (id)
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS visitor_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company TEXT NOT NULL,
                    name TEXT NOT NULL,
                    position TEXT,
                    contact TEXT,
                    last_visit_date TEXT NOT NULL
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS visit_purposes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    purpose TEXT NOT NULL,
                    selection_count INTEGER DEFAULT 0
                )
            ''')

            # 퇴실 누락 테이블 추가
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS missed_checkouts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    visitor_id INTEGER NOT NULL,
                    original_date TEXT NOT NULL,
                    checkout_date TEXT NOT NULL,
                    reason TEXT NOT NULL,  -- 'auto_checkout' 또는 'manual_checkout'
                    FOREIGN KEY (visitor_id) REFERENCES visitors (id)
                )
            ''')

            self.insert_initial_data(cursor)
            
            conn.commit()
        finally:
            conn.close()

    def insert_initial_data(self, cursor):
        # 기의 초기화 코드 수정
        # companies, departments, managers 테이블은 초��화하지 않도록 변경
        cursor.execute('DELETE FROM positions')
        cursor.execute('DELETE FROM locations')
        cursor.execute('DELETE FROM visit_purposes')

        # 초기 업체 데이터는 테이블이 비어있을 때만 삽입
        cursor.execute('SELECT COUNT(*) FROM companies')
        if cursor.fetchone()[0] == 0:
            companies = ['PIXEL', 'GENESEM', 'DAEDUCK', 'KCC', 'LGIT', 'KINSUS', 'ATI']
            cursor.executemany('INSERT OR IGNORE INTO companies (name) VALUES (?)', 
                              [(c,) for c in companies])

        # 부서 데이터가 없을 때만 삽입
        cursor.execute('SELECT COUNT(*) FROM departments')
        if cursor.fetchone()[0] == 0:
            # 부서 데이터 삽입
            departments = ['기술팀', '설비팀', '품질팀', '생산팀', '관리부']
            department_ids = {}  # 부서 이름과 ID 매핑을 저장할 딕셔너리
            
            for dept_name in departments:
                cursor.execute('INSERT INTO departments (name) VALUES (?)', (dept_name,))
                department_ids[dept_name] = cursor.lastrowid

            # 담당자 데이터 매핑
            managers_data = [
                ('기술팀', '김태건', '과장'), ('기술팀', '정태훈', '사원'),
                ('설비팀', '천���수', '대리'), ('설비팀', '김찬우', '사원'), ('설비팀', '한동권', '실장'),
                ('기술팀', '이성민', '팀장'),
                ('품질팀', '여상덕', '팀장'), ('품질팀', '이슬기', '대리'), ('품질팀', '김슬기', '사원'),
                ('품질팀', '김현진', '사원'), ('품질팀', '임성수', '사원'),
                ('생산팀', '정운교', '팀장'), ('생산팀', '조현석', '과장'), ('생산팀', '이주현', '주임'),
                ('관리부', '김정수', '팀장'), ('관리부', '김려화', '사원'),
                (None, '김원식', '부대표')
            ]
            
            for dept_name, name, position in managers_data:
                dept_id = department_ids.get(dept_name) if dept_name else None
                cursor.execute('''
                    INSERT INTO managers (department_id, name, position)
                    VALUES (?, ?, ?)
                ''', (dept_id, name, position))

        # 나지 초기 데이터 삽입
        cursor.execute('SELECT COUNT(*) FROM positions')
        if cursor.fetchone()[0] == 0:
            positions = ['사원', '주임', '계장', '대리', '과장', '팀장', '차장', '이사', '상무', '부대표', '대표']
            cursor.executemany('INSERT OR IGNORE INTO positions (title) VALUES (?)', 
                              [(p,) for p in positions])

        cursor.execute('SELECT COUNT(*) FROM locations')
        if cursor.fetchone()[0] == 0:
            locations = ['1층 현장', '2층 현장', '1층 로비', '1층 회의실', '2층 회의실']
            cursor.executemany('INSERT OR IGNORE INTO locations (name) VALUES (?)', 
                              [(l,) for l in locations])

        cursor.execute('SELECT COUNT(*) FROM visit_purposes')
        if cursor.fetchone()[0] == 0:
            purposes = ['미팅/회의', '현장 점검', '현장 방문', '설비 점검', '설비 셋업']
            cursor.executemany('INSERT OR IGNORE INTO visit_purposes (purpose) VALUES (?)',
                              [(p,) for p in purposes])

    def add_visitor(self, company, name, position, contact, visit_location, 
                   visit_purpose, manager):
        # 디버그 로그 추가
        print(f"Adding visitor: company={company}, name={name}, position={position}")
        
        # 이중 입실 체크
        if self.check_duplicate_visitor(company, name, position):
            print("Duplicate visitor detected!")  # 중복 감지 로그
            return -1
        
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            current_time = datetime.now()
            date = current_time.strftime('%Y-%m-%d')
            check_in_time = current_time.strftime('%H:%M:%S')
            
            # 방문자 등록
            cursor.execute('''
                INSERT INTO visitors (date, company, name, position, contact, 
                                    visit_location, visit_purpose, check_in_time, manager)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (date, company, name, position, contact, visit_location, 
                  visit_purpose, check_in_time, manager))
            
            # 방문자 히스토리 업데이트
            cursor.execute('''
                INSERT OR REPLACE INTO visitor_history 
                (company, name, position, contact, last_visit_date)
                VALUES (?, ?, ?, ?, ?)
            ''', (company, name, position, contact, date))
            
            conn.commit()
            return cursor.lastrowid
        finally:
            conn.close()

    def check_out_visitor(self, visitor_id):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            check_out_time = datetime.now().strftime('%H:%M:%S')
            cursor.execute('''
                UPDATE visitors 
                SET check_out_time = ? 
                WHERE id = ?
            ''', (check_out_time, visitor_id))
            conn.commit()
        finally:
            conn.close()

    def get_current_visitors(self):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            today = datetime.now().strftime('%Y-%m-%d')
            
            # 자정이 지난 미퇴실자 자동 처리
            self.auto_checkout_previous_day()
            
            # 오늘 날짜의 방문자만 조회
            cursor.execute('''
                SELECT * FROM visitors 
                WHERE date = ? 
                ORDER BY check_in_time DESC
            ''', (today,))
            return cursor.fetchall()
        finally:
            conn.close()

    def auto_checkout_previous_day(self):
        """자정이 지난 전날 미퇴실자 자동 처리"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
            
            # 전날 미퇴실자 조회
            cursor.execute('''
                SELECT id, date 
                FROM visitors 
                WHERE date = ? 
                AND check_out_time IS NULL
            ''', (yesterday,))
            
            missed_visitors = cursor.fetchall()
            
            # 각 미퇴실자에 대해 자동 퇴실 처리
            for visitor in missed_visitors:
                self.add_missed_checkout(
                    visitor_id=visitor[0],
                    original_date=visitor[1],
                    reason='자동 퇴실 처리 (자정)'
                )
            
            conn.commit()
        finally:
            conn.close()

    def get_visitors_by_date(self, date):
        """특정 날짜의 방문 기록 조회 (이력 조회용)"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM visitors 
                WHERE date = ? 
                ORDER BY check_in_time DESC
            ''', (date,))
            return cursor.fetchall()
        finally:
            conn.close()

    def get_visitors_by_month(self, year, month):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM visitors 
                WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
                ORDER BY date DESC, check_in_time DESC
            ''', (str(year), str(month).zfill(2)))
            return cursor.fetchall()
        finally:
            conn.close()

    def get_company_analytics(self):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            current_date = datetime.now().strftime('%Y-%m-%d')
            
            cursor.execute('''
                SELECT 
                    company,
                    COUNT(*) as visit_count,
                    SUM(CASE WHEN date = ? AND check_out_time IS NULL THEN 1 ELSE 0 END) as current_visitors,
                    SUM(CASE 
                        WHEN check_out_time IS NOT NULL 
                        AND status = 'NORMAL'  -- 정상 퇴실인 경우만 포함
                        THEN (
                            strftime('%s', date || ' ' || check_out_time) - 
                            strftime('%s', date || ' ' || check_in_time)
                        )
                        ELSE 0 
                    END) as total_duration,
                    (
                        SELECT name 
                        FROM visitors v2 
                        WHERE v2.company = v1.company 
                        AND v2.check_out_time IS NOT NULL
                        AND v2.status = 'NORMAL'  -- 정상 퇴실인 경우만 포함
                        ORDER BY (
                            strftime('%s', v2.date || ' ' || v2.check_out_time) - 
                            strftime('%s', v2.date || ' ' || v2.check_in_time)
                        ) DESC LIMIT 1
                    ) as longest_visitor_name,
                    (
                        SELECT position 
                        FROM visitors v2 
                        WHERE v2.company = v1.company 
                        AND v2.check_out_time IS NOT NULL
                        AND v2.status = 'NORMAL'  -- 정상 퇴실인 경우만 포함
                        ORDER BY (
                            strftime('%s', v2.date || ' ' || v2.check_out_time) - 
                            strftime('%s', v2.date || ' ' || v2.check_in_time)
                        ) DESC LIMIT 1
                    ) as longest_visitor_position,
                    (
                        SELECT MAX(
                            strftime('%s', date || ' ' || check_out_time) - 
                            strftime('%s', date || ' ' || check_in_time)
                        )
                        FROM visitors v2 
                        WHERE v2.company = v1.company 
                        AND v2.check_out_time IS NOT NULL
                        AND v2.status = 'NORMAL'  -- 정상 퇴실인 경우만 포함
                    ) as longest_duration
                FROM visitors v1
                GROUP BY company
                ORDER BY visit_count DESC
            ''', (current_date,))
            
            return cursor.fetchall()
        finally:
            conn.close()

    def get_purpose_ranking(self):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT 
                    visit_purpose,
                    COUNT(*) as visit_count
                FROM visitors
                GROUP BY visit_purpose
                ORDER BY visit_count DESC
                LIMIT 5
            ''')
            return cursor.fetchall()
        finally:
            conn.close()

    def get_companies(self):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT name 
                FROM companies 
                ORDER BY selection_count DESC, name ASC
            ''')
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_positions(self):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('SELECT title FROM positions ORDER BY selection_count DESC')
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_locations(self):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('SELECT name FROM locations ORDER BY selection_count DESC')
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_departments(self):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('SELECT id, name FROM departments ORDER BY name')
            departments = [(row[0], row[1]) for row in cursor.fetchall()]
            print("Departments from DB:", departments)  # 부서 데이터 확인
            return departments
        finally:
            conn.close()

    def get_managers_by_department(self, dept_id):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            print(f"Searching for managers with department_id: {dept_id}")  # 검색하는 부서 ID 확인
            
            cursor.execute('''
                SELECT m.*, d.name as dept_name
                FROM managers m
                LEFT JOIN departments d ON m.department_id = d.id
                WHERE m.department_id = ?
            ''', (dept_id,))
            all_results = cursor.fetchall()
            print(f"Raw query results: {all_results}")  # 쿼리 결과 확인

            cursor.execute('''
                SELECT name, position 
                FROM managers 
                WHERE department_id = ?
                ORDER BY name
            ''', (dept_id,))
            managers = cursor.fetchall()
            print(f"Formatted managers: {managers}")  # 최종 결과 확인
            return managers
        finally:
            conn.close()

    def search_managers(self, query):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT m.name, m.position, d.name as department
                FROM managers m
                LEFT JOIN departments d ON m.department_id = d.id
                WHERE m.name LIKE ?
                ORDER BY m.selection_count DESC
            ''', (f'%{query}%',))
            return cursor.fetchall()
        finally:
            conn.close()

    def get_visitor_history(self, company, name):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT position, contact
                FROM visitor_history
                WHERE company = ? AND name = ?
                ORDER BY last_visit_date DESC
                LIMIT 1
            ''', (company, name))
            return cursor.fetchone()
        finally:
            conn.close()

    def update_selection_count(self, table, field, value):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(f'''
                UPDATE {table}
                SET selection_count = selection_count + 1
                WHERE {field} = ?
            ''', (value,))
            conn.commit()
        finally:
            conn.close()

    def update_visitor_history(self, company, name, position, contact):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            current_date = datetime.now().strftime('%Y-%m-%d')
            cursor.execute('''
                INSERT OR REPLACE INTO visitor_history 
                (company, name, position, contact, last_visit_date)
                VALUES (?, ?, ?, ?, ?)
            ''', (company, name, position, contact, current_date))
            conn.commit()
        finally:
            conn.close()

    def get_visit_purposes(self):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('SELECT purpose FROM visit_purposes ORDER BY selection_count DESC')
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()

    def add_company(self, name):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            # 중복 체크
            cursor.execute('SELECT name FROM companies WHERE name = ?', (name,))
            if cursor.fetchone():
                return False, "이미 존재하는 업체입니다."
            
            # 새 업체 추가
            cursor.execute('INSERT INTO companies (name, selection_count) VALUES (?, 0)', (name,))
            conn.commit()
            return True, "업체가 추가되었습니다."
        finally:
            conn.close()

    # 퇴실 누락 처리 메서드 추가
    def add_missed_checkout(self, visitor_id, original_date, reason='auto_checkout'):
        if not visitor_id:
            raise ValueError("visitor_id is required")
        
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            checkout_date = datetime.now().strftime('%Y-%m-%d')
            checkout_time = datetime.now().strftime('%H:%M:%S')
            
            # 방문자 정보를 퇴실 처리로 업데이트 (NULL이 아닌 실제 퇴실 시간 기록)
            cursor.execute('''
                UPDATE visitors 
                SET check_out_time = ?,
                    status = 'MISSED'
                WHERE id = ?
            ''', (checkout_time, visitor_id))

            if cursor.rowcount == 0:
                raise ValueError(f"No visitor found with id {visitor_id}")

            # 퇴실 누락 기록
            cursor.execute('''
                INSERT INTO missed_checkouts 
                (visitor_id, original_date, checkout_date, reason)
                VALUES (?, ?, ?, ?)
            ''', (visitor_id, original_date, checkout_date, reason))
            
            conn.commit()
        finally:
            conn.close()

    # 퇴실 누락 목록 조회
    def get_missed_checkouts(self):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT 
                    m.id,
                    v.company,
                    v.name,
                    v.position,
                    v.visit_location,
                    v.check_in_time,
                    m.original_date,
                    m.checkout_date,
                    m.reason
                FROM missed_checkouts m
                JOIN visitors v ON m.visitor_id = v.id
                ORDER BY m.checkout_date DESC, v.check_in_time DESC
            ''')
            return cursor.fetchall()
        finally:
            conn.close()

    # 이중 입실 체크 메서드 추가
    def check_duplicate_visitor(self, company, name, position):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            # 디버그 로그 추가
            print(f"Checking duplicate for: company={company}, name={name}, position={position}")
            
            cursor.execute('''
                SELECT id, company, name, position, check_in_time 
                FROM visitors 
                WHERE date = ? 
                AND company = ? 
                AND name = ? 
                AND position = ? 
                AND check_out_time IS NULL
            ''', (
                datetime.now().strftime('%Y-%m-%d'),
                company,
                name,
                position
            ))
            result = cursor.fetchone()
            print(f"Duplicate check result: {result}")  # 결과 로그
            return result is not None
        finally:
            conn.close()

    def get_missed_checkouts_by_month(self, year, month):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            start_date = f"{year}-{month:02d}-01"
            end_date = f"{year}-{month:02d}-31"  # 31일로 해도 DB에서 알아서 처리
            
            cursor.execute('''
                SELECT 
                    m.id,
                    v.company,
                    v.name,
                    v.position,
                    v.visit_location,
                    v.check_in_time,
                    m.original_date,
                    m.checkout_date,
                    m.reason
                FROM missed_checkouts m
                JOIN visitors v ON m.visitor_id = v.id
                WHERE m.original_date BETWEEN ? AND ?
                ORDER BY m.original_date DESC, v.check_in_time DESC
            ''', (start_date, end_date))
            return cursor.fetchall()
        finally:
            conn.close()
