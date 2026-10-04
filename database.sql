-- ตารางผู้ใช้

CREATE TABLE users (

  id SERIAL PRIMARY KEY,

  student_id TEXT NOT NULL UNIQUE,

  password TEXT NOT NULL,

  name TEXT NOT NULL

);

-- ตารางการจอง

CREATE TABLE bookings (

  id SERIAL PRIMARY KEY,

  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  date DATE NOT NULL,

  time TEXT NOT NULL,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- เพิ่มผู้ใช้ทดสอบ

INSERT INTO users (student_id, password, name)

VALUES ('6510110101', '123456', 'ทดสอบ ระบบ')

ON CONFLICT (student_id) DO NOTHING;
 