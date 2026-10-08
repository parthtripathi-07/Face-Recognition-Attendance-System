import os
import sys
import json
import logging
from pathlib import Path
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("faceattend.init_postgres")

def setup_postgres(password: str, user: str = "postgres", host: str = "localhost", port: int = 5432, db_name: str = "faceattend_ai"):
    logger.info(f"Connecting to PostgreSQL server at {host}:{port} as user '{user}'...")
    
    # 1. Connect to default postgres DB to create target DB if needed
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname="postgres",
            connect_timeout=5
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Failed to connect to PostgreSQL: {e}")
        return False, str(e)

    # Check if database exists
    cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{db_name}';")
    exists = cur.fetchone()
    if not exists:
        logger.info(f"Database '{db_name}' does not exist. Creating database...")
        cur.execute(f"CREATE DATABASE {db_name};")
        logger.info(f"Database '{db_name}' created successfully.")
    else:
        logger.info(f"Database '{db_name}' already exists.")
    cur.close()
    conn.close()

    # 2. Connect to faceattend_ai DB to create tables
    logger.info(f"Connecting to '{db_name}' to initialize tables and indexes...")
    conn = psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=db_name,
        connect_timeout=5
    )
    cur = conn.cursor()

    # Create tables
    cur.execute("""
    -- Admins Table
    CREATE TABLE IF NOT EXISTS admins (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        role VARCHAR(50) DEFAULT 'admin',
        is_default_demo BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- Students Table
    CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        roll_number VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        branch VARCHAR(100) NOT NULL,
        year VARCHAR(50) NOT NULL,
        section VARCHAR(50),
        face_registered BOOLEAN DEFAULT FALSE,
        samples_count INT DEFAULT 0,
        data JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);
    CREATE INDEX IF NOT EXISTS idx_students_branch ON students(branch);

    -- Face Embeddings Table
    CREATE TABLE IF NOT EXISTS face_embeddings (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(100) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
        student_name VARCHAR(255),
        roll_number VARCHAR(100),
        sample_index INT DEFAULT 0,
        quality_score FLOAT DEFAULT 1.0,
        embedding JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_embeddings_student ON face_embeddings(student_id);

    -- Attendance Sessions Table
    CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(100) UNIQUE NOT NULL,
        subject VARCHAR(255) NOT NULL,
        branch VARCHAR(100) NOT NULL,
        year VARCHAR(50) NOT NULL,
        section VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        start_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- Attendance Table
    CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(100) NOT NULL,
        student_name VARCHAR(255),
        roll_number VARCHAR(100),
        branch VARCHAR(100),
        year VARCHAR(50),
        section VARCHAR(50),
        date VARCHAR(20) NOT NULL,
        time VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'Present',
        confidence FLOAT DEFAULT 0.0,
        confidence_percent FLOAT DEFAULT 0.0,
        session_id VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);

    -- Settings Table
    CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(64) PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.commit()
    logger.info("PostgreSQL database tables and indexes created successfully.")

    # 3. Migrate existing JSON data
    storage_dir = Path(__file__).parent / "data" / "storage"
    if storage_dir.exists():
        logger.info("Migrating existing student & attendance data to PostgreSQL...")
        
        # Migrate Students
        students_file = storage_dir / "students.json"
        if students_file.exists():
            with open(students_file, "r", encoding="utf-8") as f:
                st_data = json.load(f)
            for s in st_data:
                cur.execute("""
                INSERT INTO students (id, student_id, name, roll_number, email, phone, branch, year, section, face_registered, samples_count, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (student_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    roll_number = EXCLUDED.roll_number,
                    face_registered = EXCLUDED.face_registered,
                    samples_count = EXCLUDED.samples_count;
                """, (
                    s.get("_id") or s.get("id"),
                    s.get("studentId"),
                    s.get("name"),
                    s.get("rollNumber"),
                    s.get("email"),
                    s.get("phone"),
                    s.get("branch"),
                    s.get("year"),
                    s.get("section"),
                    s.get("faceRegistered", False),
                    s.get("samplesCount", 0),
                    s.get("createdAt"),
                    s.get("updatedAt")
                ))
            conn.commit()
            logger.info(f"Migrated {len(st_data)} students to PostgreSQL.")

        # Migrate Face Embeddings
        embeddings_file = storage_dir / "face_embeddings.json"
        if embeddings_file.exists():
            with open(embeddings_file, "r", encoding="utf-8") as f:
                em_data = json.load(f)
            for e in em_data:
                cur.execute("""
                INSERT INTO face_embeddings (id, student_id, student_name, roll_number, sample_index, quality_score, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
                """, (
                    e.get("_id") or e.get("id"),
                    e.get("studentId"),
                    e.get("name") or e.get("studentName"),
                    e.get("rollNumber"),
                    e.get("sampleIndex", 0),
                    e.get("qualityScore", 1.0),
                    json.dumps(e.get("embedding", []))
                ))
            conn.commit()
            logger.info(f"Migrated {len(em_data)} face embedding vectors to PostgreSQL.")

        # Migrate Attendance
        att_file = storage_dir / "attendance.json"
        if att_file.exists():
            with open(att_file, "r", encoding="utf-8") as f:
                att_data = json.load(f)
            for a in att_data:
                cur.execute("""
                INSERT INTO attendance (id, student_id, student_name, roll_number, branch, year, section, date, time, status, confidence, confidence_percent, session_id, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
                """, (
                    a.get("_id") or a.get("id"),
                    a.get("studentId"),
                    a.get("studentName"),
                    a.get("rollNumber"),
                    a.get("branch"),
                    a.get("year"),
                    a.get("section"),
                    a.get("date"),
                    a.get("time"),
                    a.get("status", "Present"),
                    a.get("confidence", 0.0),
                    a.get("confidencePercent", 0.0),
                    a.get("sessionId"),
                    a.get("createdAt")
                ))
            conn.commit()
            logger.info(f"Migrated {len(att_data)} attendance records to PostgreSQL.")

    cur.close()
    conn.close()

    # 4. Update .env with PostgreSQL connection string
    env_path = Path(__file__).parent / ".env"
    pg_url = f"postgresql://{user}:{password}@{host}:{port}/{db_name}"
    
    env_content = ""
    if env_path.exists():
        env_content = env_path.read_text(encoding="utf-8")
    
    if "POSTGRES_URL=" in env_content:
        import re
        env_content = re.sub(r"POSTGRES_URL=.*", f"POSTGRES_URL={pg_url}", env_content)
    else:
        env_content += f"\nPOSTGRES_URL={pg_url}\n"
        
    if "DB_BACKEND=" in env_content:
        import re
        env_content = re.sub(r"DB_BACKEND=.*", "DB_BACKEND=postgres", env_content)
    else:
        env_content += "DB_BACKEND=postgres\n"

    env_path.write_text(env_content, encoding="utf-8")
    logger.info(f"Updated backend/.env with PostgreSQL connection settings.")
    return True, "PostgreSQL setup and migration complete."

if __name__ == "__main__":
    if len(sys.argv) > 1:
        pwd = sys.argv[1]
        success, msg = setup_postgres(pwd)
        print("RESULT:", success, msg)
    else:
        print("Usage: python init_postgres.py <password>")
