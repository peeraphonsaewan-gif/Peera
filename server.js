const express = require('express');

const { createClient } = require('@supabase/supabase-js');

const cors = require('cors');

const path = require('path');

const app = express();

const PORT = 3001;

// ===== ใส่ค่าถูกต้องตรงนี้ =====

const SUPABASE_URL = 'https://aehwomtpxogzvoenyao.supabase.co';

const SUPABASE_SERVICE_KEY = '';

// ==============================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

app.use(cors());

app.use(express.json());

app.use(express.static(__dirname));

// ===== รับเข้าสู่ระบบ =====

app.post('/api/login', async (req, res) => {

  try {

    const { studentId, password } = req.body;

    if (!studentId || !password) {

      return res.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });

    }

    const { data: user, error } = await supabase

      .from('users')

      .select('*')

      .eq('student_id', studentId)

      .single();

    if (error || !user) {

      return res.json({ success: false, message: 'ไม่พบรหัสนิสิตนี้ในระบบ' });

    }

    if (user.password !== password) {

      return res.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });

    }

    res.json({

      success: true,

      user: {

        name: user.name,

        studentId: user.student_id,

        role: user.role

      }

    });

  } catch (err) {

    console.error('Error:', err);

    res.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });

  }

});

// ===== รันเซิร์ฟเวอร์ =====

app.listen(PORT, () => {

  console.log('========================================');

  console.log('✅ ระบบทำงานที่: http://localhost:' + PORT);

  console.log('========================================');

});
 