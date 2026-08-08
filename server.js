// ============================================
// ===== NJ CABUÇU - SERVIDOR COMPLETO =====
// ============================================

require('dotenv').config();
console.log('🚀 Iniciando NJ Cabuçu...');

const express = require('express');
const cors = require('cors');
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const nodemailer = require('nodemailer');

// ============================================
// ===== CONEXÃO NEON =====
// ============================================
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não encontrada!');
    process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
console.log('✅ Conectado ao Neon Database');

// ============================================
// ===== NODEMAILER - CONFIGURAÇÃO =====
// ============================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'mvini440@gmail.com',
        pass: process.env.EMAIL_PASS || '26588772'
    },
    tls: {
        rejectUnauthorized: false
    }
});

// ============================================
// ===== FUNÇÃO PARA ENVIAR E-MAIL =====
// ============================================
async function sendPaymentConfirmationEmail(paymentData) {
    const { 
        email, 
        name, 
        payment_id, 
        amount, 
        description, 
        status,
        type 
    } = paymentData;

    if (!email) {
        console.log('⚠️ Email não informado, não é possível enviar confirmação');
        return;
    }

    const statusText = status === 'approved' ? '✅ APROVADO' : '⏳ PENDENTE';
    const statusColor = status === 'approved' ? '#28a745' : '#ffc107';
    const typeText = type === 'donation' ? 'Doação' : 'Compra';
    const churchName = 'NJ Cabuçu';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmação de Pagamento</title>
        <style>
            body { font-family: Arial, sans-serif; background-color: #f5f7fc; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
            .header { text-align: center; padding: 20px 0; border-bottom: 3px solid #0D47A1; }
            .header h1 { color: #0D47A1; margin: 0; font-size: 24px; }
            .header .subtitle { color: #F5A623; font-weight: 600; }
            .content { padding: 20px 0; }
            .status-badge { display: inline-block; padding: 8px 20px; border-radius: 50px; font-weight: 700; font-size: 16px; background-color: ${statusColor}; color: white; }
            .info-card { background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #0D47A1; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e8e8e8; }
            .info-row:last-child { border-bottom: none; }
            .info-label { color: #666; font-weight: 500; }
            .info-value { color: #1a1a2e; font-weight: 600; }
            .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e8e8e8; color: #888; font-size: 14px; }
            .footer .verse { font-style: italic; color: #0D47A1; margin: 10px 0; }
            .btn { display: inline-block; padding: 12px 30px; background: #0D47A1; color: white; text-decoration: none; border-radius: 50px; font-weight: 600; }
            .btn:hover { background: #0A3A7A; }
            .social { margin-top: 20px; }
            .social a { color: #0D47A1; text-decoration: none; margin: 0 10px; font-size: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🙏 ${churchName}</h1>
                <p class="subtitle">Confirmação de ${typeText}</p>
            </div>
            <div class="content">
                <div style="text-align: center; margin-bottom: 20px;">
                    <span class="status-badge">${statusText}</span>
                </div>
                <p style="font-size: 16px; color: #1a1a2e;">
                    Olá <strong>${name || 'Cliente'}</strong>,
                </p>
                <p style="font-size: 16px; color: #1a1a2e; margin-top: 8px;">
                    ${status === 'approved' 
                        ? '✅ Seu pagamento foi aprovado com sucesso! Agradecemos sua contribuição.' 
                        : '⏳ Seu pagamento está sendo processado. Você receberá a confirmação em breve.'}
                </p>
                <div class="info-card">
                    <div class="info-row">
                        <span class="info-label">📋 Tipo</span>
                        <span class="info-value">${typeText}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">💰 Valor</span>
                        <span class="info-value">R$ ${parseFloat(amount).toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📝 Descrição</span>
                        <span class="info-value">${description || 'Pagamento NJ Cabuçu'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">🆔 ID do Pagamento</span>
                        <span class="info-value" style="font-size: 12px; word-break: break-all;">${payment_id}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📅 Data</span>
                        <span class="info-value">${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
                ${status === 'approved' ? `
                <div style="background: #d4edda; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: center; border: 1px solid #c3e6cb;">
                    <p style="color: #155724; margin: 0; font-weight: 600; font-size: 16px;">
                        🙌 Deus abençoe sua vida! Obrigado por contribuir com a obra de Deus.
                    </p>
                </div>
                ` : `
                <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: center; border: 1px solid #f5e3b0;">
                    <p style="color: #856404; margin: 0; font-weight: 500; font-size: 14px;">
                        ⏳ Seu pagamento está sendo processado. Em instantes você receberá a confirmação.
                    </p>
                </div>
                `}
                <div style="text-align: center; margin-top: 20px;">
                    <a href="${process.env.PUBLIC_URL || 'https://igrejanjcabucurj.vercel.app'}" class="btn">
                        <i class="fas fa-home"></i> Visitar Site
                    </a>
                </div>
            </div>
            <div class="footer">
                <p class="verse">"E conhecereis a verdade, e a verdade vos libertará." - João 8:32</p>
                <p>${churchName} - © ${new Date().getFullYear()} Todos os direitos reservados</p>
                <div class="social">
                    <a href="https://www.instagram.com/novajerusalemcabucu/" target="_blank">📸</a>
                    <a href="https://wa.me/5521985345627" target="_blank">💬</a>
                    <a href="#" target="_blank">▶️</a>
                </div>
                <p style="font-size: 12px; margin-top: 10px;">
                    Este e-mail foi enviado automaticamente. Por favor, não responda.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const mailOptions = {
            from: `"NJ Cabuçu" <${process.env.EMAIL_USER || 'mvini440@gmail.com'}>`,
            to: email,
            subject: `✅ Confirmação de ${typeText} - NJ Cabuçu`,
            html: html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 E-mail de confirmação enviado para ${email}:`, info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Erro ao enviar e-mail:', error.message);
        return null;
    }
}

// ============================================
// ===== MERCADO PAGO =====
// ============================================
let PaymentService = null;
try {
    if (process.env.MP_ACCESS_TOKEN) {
        const client = new MercadoPagoConfig({
            accessToken: process.env.MP_ACCESS_TOKEN,
            options: { timeout: 30000 }
        });
        PaymentService = new Payment(client);
        console.log('✅ Mercado Pago configurado');
    }
} catch (error) {
    console.log('⚠️ Erro MP:', error.message);
}

// ============================================
// ===== APP =====
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.PUBLIC_URL || `https://igrejanjcabucurj.vercel.app`;

app.use(cors({
    origin: ['https://igrejanjcabucurj.vercel.app', 'http://localhost:3000', 'http://localhost:3001', '*'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

// ============================================
// ===== MULTER =====
// ============================================
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas!'));
        }
    }
});

// ============================================
// ===== FUNÇÕES =====
// ============================================
const hashPassword = async (pwd) => await bcrypt.hash(pwd, 10);
const verifyPassword = async (pwd, hash) => await bcrypt.compare(pwd, hash);

const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido' });
    }
};

const pastorOnly = (req, res, next) => {
    if (req.user?.role !== 'pastor') {
        return res.status(403).json({ error: 'Apenas o pastor' });
    }
    next();
};

// ============================================
// ===== INICIALIZAR BANCO =====
// ============================================
async function initDB() {
    console.log('📝 Criando tabelas...');
    
    try {
        await sql`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'colaborador',
            department_id INTEGER,
            department_name VARCHAR(100),
            first_login BOOLEAN DEFAULT true,
            phone VARCHAR(20),
            is_leader BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS departments (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            leader_id INTEGER,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS department_members (
            department_id INTEGER,
            user_id INTEGER,
            role VARCHAR(50) DEFAULT 'membro',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (department_id, user_id)
        )`;

        await sql`CREATE TABLE IF NOT EXISTS studies (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            file_url VARCHAR(500),
            image_url VARCHAR(500),
            image_base64 TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            image_url VARCHAR(500),
            image_base64 TEXT,
            stock INTEGER DEFAULT 0,
            category VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            date TIMESTAMP NOT NULL,
            image_url VARCHAR(500),
            image_base64 TEXT,
            price DECIMAL(10,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS prayers (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            request TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_name VARCHAR(100),
            user_email VARCHAR(100),
            user_phone VARCHAR(20),
            items TEXT,
            total DECIMAL(10,2) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            payment_id VARCHAR(100),
            payment_method VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS registrations (
            id SERIAL PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100),
            phone VARCHAR(20),
            department_name VARCHAR(100),
            event_name VARCHAR(200),
            details TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            amount DECIMAL(10,2) DEFAULT 0,
            is_paid BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS worship_scales (
            id SERIAL PRIMARY KEY,
            department_id INTEGER,
            event_date TIMESTAMP NOT NULL,
            leader_id INTEGER,
            minister_id INTEGER,
            songs TEXT[],
            song_ids TEXT,
            musician_ids TEXT,
            palette TEXT,
            rehearsal BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS donations (
            id SERIAL PRIMARY KEY,
            user_name VARCHAR(100),
            user_email VARCHAR(100),
            user_phone VARCHAR(20),
            type VARCHAR(50) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            payment_id VARCHAR(100),
            payment_method VARCHAR(50),
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS carousel_images (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200),
            subtitle VARCHAR(200),
            image_url VARCHAR(500),
            image_base64 TEXT,
            link VARCHAR(500),
            order_position INTEGER DEFAULT 0,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS site_settings (
            id SERIAL PRIMARY KEY,
            key VARCHAR(100) UNIQUE NOT NULL,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS members (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100),
            phone VARCHAR(20),
            birth_date DATE,
            marital_status VARCHAR(20) DEFAULT 'solteiro',
            spouse_name VARCHAR(100),
            children TEXT,
            baptism_date DATE,
            baptism_place VARCHAR(100),
            address TEXT,
            department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
            department_name VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS attendance (
            id SERIAL PRIMARY KEY,
            member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
            event_date DATE NOT NULL,
            service_type VARCHAR(50) DEFAULT 'domingo',
            present BOOLEAN DEFAULT false,
            check_in_time TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(member_id, event_date, service_type)
        )`;

        await sql`CREATE TABLE IF NOT EXISTS tithes (
            id SERIAL PRIMARY KEY,
            member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
            member_name VARCHAR(100),
            type VARCHAR(20) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            payment_method VARCHAR(20) DEFAULT 'dinheiro',
            payment_date DATE DEFAULT CURRENT_DATE,
            description TEXT,
            received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS bills (
            id SERIAL PRIMARY KEY,
            description VARCHAR(200) NOT NULL,
            category VARCHAR(50) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            due_date DATE NOT NULL,
            paid BOOLEAN DEFAULT false,
            payment_date DATE,
            payment_method VARCHAR(20),
            notes TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS birthdays (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            birth_date DATE NOT NULL,
            phone VARCHAR(20),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS weddings (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            spouse_name VARCHAR(100) NOT NULL,
            wedding_date DATE NOT NULL,
            phone VARCHAR(20),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS baptism_dates (
            id SERIAL PRIMARY KEY,
            date TIMESTAMP NOT NULL,
            title VARCHAR(200) DEFAULT 'Batismo',
            description TEXT,
            max_participants INTEGER DEFAULT 20,
            current_participants INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS songs (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            artist VARCHAR(100),
            key VARCHAR(10) DEFAULT 'C',
            lyrics TEXT,
            department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS availability (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            date TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, date)
        )`;

        console.log('✅ Tabelas criadas');

        const existing = await sql`SELECT * FROM users WHERE email = 'pastor@njcabucu.com'`;
        if (existing.length === 0) {
            const hash = await hashPassword('admin123');
            await sql`
                INSERT INTO users (name, email, password_hash, role, department_name, first_login, is_leader)
                VALUES ('Pastor', 'pastor@njcabucu.com', ${hash}, 'pastor', 'Administração', false, true)
            `;
            console.log('✅ Pastor criado: pastor@njcabucu.com / admin123');
        }

        console.log('🎉 Sistema pronto!');
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

initDB();

// ============================================
// ===== ROTAS DE AUTENTICAÇÃO =====
// ============================================

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (users.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });
        
        const user = users[0];
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Senha incorreta' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                department_id: user.department_id,
                department_name: user.department_name,
                first_login: user.first_login || false,
                phone: user.phone || '',
                is_leader: user.is_leader || false
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/change-password', async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;
        const users = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

        const user = users[0];
        if (!user.first_login && currentPassword) {
            const valid = await verifyPassword(currentPassword, user.password_hash);
            if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
        }

        const hash = await hashPassword(newPassword);
        await sql`UPDATE users SET password_hash = ${hash}, first_login = false WHERE id = ${user.id}`;
        res.json({ message: 'Senha alterada com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE USUÁRIOS =====
// ============================================

app.post('/api/users', auth, pastorOnly, async (req, res) => {
    try {
        const { name, email, password, role, department_name, phone, is_leader, department_id } = req.body;
        
        const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Usuário já existe' });
        }

        const hash = await hashPassword(password || '123456');
        
        let deptId = department_id || null;
        let deptName = department_name || null;
        
        if (deptId) {
            const dept = await sql`SELECT name FROM departments WHERE id = ${deptId}`;
            if (dept.length > 0) {
                deptName = dept[0].name;
            }
        }

        const result = await sql`
            INSERT INTO users (name, email, password_hash, role, department_id, department_name, phone, first_login, is_leader)
            VALUES (${name}, ${email}, ${hash}, ${role || 'colaborador'}, ${deptId}, ${deptName}, ${phone || ''}, true, ${is_leader || false})
            RETURNING id, name, email, role, department_id, department_name, is_leader
        `;
        
        if (deptId) {
            const memberRole = is_leader ? 'lider' : 'membro';
            await sql`
                INSERT INTO department_members (department_id, user_id, role)
                VALUES (${deptId}, ${result[0].id}, ${memberRole})
                ON CONFLICT (department_id, user_id) DO UPDATE SET role = ${memberRole}
            `;
            
            if (is_leader) {
                await sql`
                    UPDATE departments SET leader_id = ${result[0].id} WHERE id = ${deptId}
                `;
            }
        }
        
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', auth, async (req, res) => {
    try {
        let users;
        if (req.user.role === 'pastor') {
            users = await sql`
                SELECT id, name, email, role, department_id, department_name, phone, first_login, is_leader, created_at
                FROM users ORDER BY name
            `;
        } else {
            const deptId = req.user.department_id;
            if (!deptId) return res.json([]);
            users = await sql`
                SELECT id, name, email, role, department_id, department_name, phone, first_login, is_leader, created_at
                FROM users WHERE department_id = ${deptId}
                ORDER BY name
            `;
        }
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/users/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM users WHERE id = ${req.params.id}`;
        res.json({ message: 'Usuário removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reset-password', auth, pastorOnly, async (req, res) => {
    try {
        const { email } = req.body;
        const hash = await hashPassword('123456');
        await sql`UPDATE users SET password_hash = ${hash}, first_login = true WHERE email = ${email}`;
        res.json({ message: 'Senha resetada para 123456' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE DEPARTAMENTOS =====
// ============================================

app.post('/api/departments', auth, pastorOnly, async (req, res) => {
    try {
        const { name, description } = req.body;
        const result = await sql`
            INSERT INTO departments (name, description, created_by)
            VALUES (${name}, ${description || ''}, ${req.user.id})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/departments', auth, async (req, res) => {
    try {
        const depts = await sql`
            SELECT d.*, u.name as leader_name
            FROM departments d
            LEFT JOIN users u ON d.leader_id = u.id
            WHERE d.is_active = true
            ORDER BY d.name
        `;
        res.json(depts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/departments/active', async (req, res) => {
    try {
        const depts = await sql`
            SELECT id, name, description, leader_id
            FROM departments 
            WHERE is_active = true 
            ORDER BY name
        `;
        res.json(depts);
    } catch (error) {
        console.error('❌ Erro ao buscar departamentos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/departments/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`UPDATE departments SET is_active = false WHERE id = ${req.params.id}`;
        res.json({ message: 'Departamento removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE ESTUDOS =====
// ============================================

app.post('/api/studies', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, file_url } = req.body;
        let image_base64 = null;

        if (req.file) {
            image_base64 = req.file.buffer.toString('base64');
        }

        const result = await sql`
            INSERT INTO studies (title, description, file_url, image_base64)
            VALUES (${title}, ${description}, ${file_url}, ${image_base64})
            RETURNING *
        `;
        console.log('✅ Estudo criado:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar estudo:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/studies', async (req, res) => {
    try {
        const studies = await sql`SELECT * FROM studies ORDER BY created_at DESC`;
        res.json(studies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/studies/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM studies WHERE id = ${req.params.id}`;
        res.json({ message: 'Estudo removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE PRODUTOS =====
// ============================================

app.post('/api/products', auth, upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, stock, category } = req.body;
        let image_base64 = null;

        if (req.file) {
            image_base64 = req.file.buffer.toString('base64');
        }

        const result = await sql`
            INSERT INTO products (name, description, price, image_base64, stock, category)
            VALUES (${name}, ${description}, ${parseFloat(price)}, ${image_base64}, ${parseInt(stock) || 0}, ${category || ''})
            RETURNING *
        `;
        console.log('✅ Produto criado:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await sql`SELECT * FROM products ORDER BY name`;
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM products WHERE id = ${req.params.id}`;
        res.json({ message: 'Produto removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE EVENTOS =====
// ============================================

app.post('/api/events', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, date, price } = req.body;
        let image_base64 = null;

        if (req.file) {
            image_base64 = req.file.buffer.toString('base64');
        }

        const result = await sql`
            INSERT INTO events (title, description, date, image_base64, price)
            VALUES (${title}, ${description}, ${date || new Date()}, ${image_base64}, ${parseFloat(price) || 0})
            RETURNING *
        `;
        console.log('✅ Evento criado:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar evento:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/events', async (req, res) => {
    try {
        const events = await sql`SELECT * FROM events ORDER BY date DESC`;
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/events/active', async (req, res) => {
    try {
        const events = await sql`
            SELECT id, title, description, date, price, image_base64
            FROM events 
            WHERE date >= NOW() 
            ORDER BY date ASC
        `;
        res.json(events);
    } catch (error) {
        console.error('❌ Erro ao buscar eventos ativos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/events/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM events WHERE id = ${req.params.id}`;
        res.json({ message: 'Evento removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE ORAÇÕES =====
// ============================================

app.post('/api/prayers', async (req, res) => {
    try {
        const { name, request } = req.body;
        const result = await sql`
            INSERT INTO prayers (name, request)
            VALUES (${name || 'Anônimo'}, ${request})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/prayers', auth, async (req, res) => {
    try {
        const prayers = await sql`SELECT * FROM prayers ORDER BY created_at DESC`;
        res.json(prayers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/prayers/:id/read', auth, async (req, res) => {
    try {
        await sql`UPDATE prayers SET is_read = TRUE WHERE id = ${req.params.id}`;
        res.json({ message: 'Marcado como lido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE PEDIDOS =====
// ============================================

app.post('/api/orders', async (req, res) => {
    try {
        const { user_name, user_email, user_phone, items, total, payment_id, payment_method, status } = req.body;
        const result = await sql`
            INSERT INTO orders (user_name, user_email, user_phone, items, total, payment_id, payment_method, status)
            VALUES (${user_name}, ${user_email}, ${user_phone || ''}, ${JSON.stringify(items)}, ${total}, ${payment_id}, ${payment_method}, ${status || 'pending'})
            RETURNING *
        `;
        console.log('✅ Pedido criado:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar pedido:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orders', auth, async (req, res) => {
    try {
        const orders = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sales-stats', auth, pastorOnly, async (req, res) => {
    try {
        const totalSales = await sql`
            SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM orders
        `;
        
        const salesByDay = await sql`
            SELECT 
                DATE(created_at) as date, 
                COUNT(*) as count, 
                COALESCE(SUM(total), 0) as total 
            FROM orders 
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `;
        
        const result = {
            total: totalSales[0] || { count: 0, total: 0 },
            byDay: salesByDay || []
        };
        
        res.json(result);
    } catch (error) {
        console.error('❌ Erro nas estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE INSCRIÇÕES =====
// ============================================

app.post('/api/registrations', async (req, res) => {
    try {
        const { type, name, email, phone, department_name, event_name, details, amount, is_paid, birth_date, baptism_date, baptism_date_id } = req.body;
        
        let finalDetails = details || '';
        
        if (type === 'baptism' && birth_date) {
            finalDetails = `Data de Nascimento: ${new Date(birth_date).toLocaleDateString('pt-BR')}\n`;
            if (baptism_date) {
                finalDetails += `Data do Batismo: ${new Date(baptism_date).toLocaleDateString('pt-BR', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}\n`;
            }
            finalDetails += details || '';
            
            if (baptism_date_id) {
                await sql`
                    UPDATE baptism_dates 
                    SET current_participants = current_participants + 1 
                    WHERE id = ${baptism_date_id}
                `;
            }
        }

        const result = await sql`
            INSERT INTO registrations (type, name, email, phone, department_name, event_name, details, amount, is_paid)
            VALUES (${type}, ${name}, ${email || ''}, ${phone || ''}, ${department_name || ''}, ${event_name || ''}, ${finalDetails || ''}, ${parseFloat(amount) || 0}, ${is_paid || false})
            RETURNING *
        `;
        console.log('✅ Inscrição criada:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro inscrição:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/registrations', auth, async (req, res) => {
    try {
        const registrations = await sql`SELECT * FROM registrations ORDER BY created_at DESC`;
        res.json(registrations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/registrations/:id/approve', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await sql`UPDATE registrations SET status = 'approved' WHERE id = ${id}`;
        res.json({ message: 'Inscrição aprovada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/registrations/:id', auth, async (req, res) => {
    try {
        await sql`DELETE FROM registrations WHERE id = ${req.params.id}`;
        res.json({ message: 'Inscrição removida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE DOAÇÕES =====
// ============================================

app.post('/api/donations', async (req, res) => {
    try {
        const { user_name, user_email, user_phone, type, amount, payment_id, payment_method, status } = req.body;
        const result = await sql`
            INSERT INTO donations (user_name, user_email, user_phone, type, amount, payment_id, payment_method, status)
            VALUES (${user_name}, ${user_email}, ${user_phone || ''}, ${type}, ${amount}, ${payment_id}, ${payment_method}, ${status || 'pending'})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/donations', auth, async (req, res) => {
    try {
        const donations = await sql`SELECT * FROM donations ORDER BY created_at DESC`;
        res.json(donations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE ANIVERSARIANTES =====
// ============================================

app.get('/api/birthdays', async (req, res) => {
    try {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        
        const birthdayMembers = await sql`
            SELECT 
                id, 
                name, 
                birth_date,
                phone,
                department_name,
                'member' as source
            FROM members 
            WHERE is_active = true 
            AND EXTRACT(MONTH FROM birth_date) = ${currentMonth}
            ORDER BY EXTRACT(DAY FROM birth_date)
        `;
        
        const birthdayLegacy = await sql`
            SELECT 
                id, 
                name, 
                birth_date,
                phone,
                NULL as department_name,
                'legacy' as source
            FROM birthdays 
            WHERE is_active = true 
            AND EXTRACT(MONTH FROM birth_date) = ${currentMonth}
            ORDER BY EXTRACT(DAY FROM birth_date)
        `;
        
        const allBirthdays = [...birthdayMembers, ...birthdayLegacy];
        const uniqueBirthdays = [];
        const names = new Set();
        
        allBirthdays.forEach(b => {
            if (!names.has(b.name)) {
                names.add(b.name);
                uniqueBirthdays.push(b);
            }
        });
        
        res.json(uniqueBirthdays);
    } catch (error) {
        console.error('❌ Erro ao buscar aniversariantes:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/birthdays/today', async (req, res) => {
    try {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();
        
        const birthdayMembers = await sql`
            SELECT 
                id, 
                name, 
                birth_date,
                phone,
                department_name
            FROM members 
            WHERE is_active = true 
            AND EXTRACT(MONTH FROM birth_date) = ${currentMonth}
            AND EXTRACT(DAY FROM birth_date) = ${currentDay}
            ORDER BY name
        `;
        
        res.json(birthdayMembers);
    } catch (error) {
        console.error('❌ Erro ao buscar aniversariantes do dia:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE MEMBROS =====
// ============================================

app.post('/api/members', auth, async (req, res) => {
    try {
        const { 
            name, email, phone, birth_date, marital_status, spouse_name, 
            children, baptism_date, baptism_place, address, 
            department_id, department_name, notes 
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const result = await sql`
            INSERT INTO members (
                name, email, phone, birth_date, marital_status, spouse_name,
                children, baptism_date, baptism_place, address,
                department_id, department_name, notes, created_by
            ) VALUES (
                ${name}, ${email}, ${phone}, ${birth_date}, ${marital_status}, ${spouse_name},
                ${children}, ${baptism_date}, ${baptism_place}, ${address},
                ${department_id}, ${department_name}, ${notes}, ${req.user.id}
            ) RETURNING *
        `;

        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar membro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/members', auth, async (req, res) => {
    try {
        const members = await sql`
            SELECT * FROM members 
            WHERE is_active = true 
            ORDER BY name
        `;
        res.json(members);
    } catch (error) {
        console.error('❌ Erro ao listar membros:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/members/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const member = await sql`SELECT * FROM members WHERE id = ${id}`;
        
        if (member.length === 0) {
            return res.status(404).json({ error: 'Membro não encontrado' });
        }

        const attendance = await sql`
            SELECT * FROM attendance 
            WHERE member_id = ${id} 
            ORDER BY event_date DESC 
            LIMIT 10
        `;

        res.json({
            ...member[0],
            attendance: attendance
        });
    } catch (error) {
        console.error('❌ Erro ao buscar membro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/members/:id', auth, async (req, res) => {
    try {
        await sql`UPDATE members SET is_active = false WHERE id = ${req.params.id}`;
        res.json({ message: 'Membro removido com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover membro:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE FREQUÊNCIA =====
// ============================================

app.post('/api/attendance', auth, async (req, res) => {
    try {
        const { member_id, event_date, service_type, present } = req.body;

        if (!member_id || !event_date) {
            return res.status(400).json({ error: 'Membro e data são obrigatórios' });
        }

        const result = await sql`
            INSERT INTO attendance (member_id, event_date, service_type, present, check_in_time)
            VALUES (${member_id}, ${event_date}, ${service_type || 'domingo'}, ${present || false}, ${present ? new Date() : null})
            ON CONFLICT (member_id, event_date, service_type) 
            DO UPDATE SET present = ${present || false}, check_in_time = ${present ? new Date() : null}
            RETURNING *
        `;

        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao registrar frequência:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/attendance/date/:date', auth, async (req, res) => {
    try {
        const { date } = req.params;
        
        const records = await sql`
            SELECT a.*, m.name as member_name
            FROM attendance a
            LEFT JOIN members m ON a.member_id = m.id
            WHERE a.event_date = ${date}
            ORDER BY a.created_at DESC
        `;
        
        res.json(records);
    } catch (error) {
        console.error('❌ Erro ao buscar frequência por data:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE DÍZIMOS =====
// ============================================

app.post('/api/tithes', auth, async (req, res) => {
    try {
        const { member_id, member_name, type, amount, payment_method, payment_date, description } = req.body;

        if (!type || !amount) {
            return res.status(400).json({ error: 'Tipo e valor são obrigatórios' });
        }

        const result = await sql`
            INSERT INTO tithes (member_id, member_name, type, amount, payment_method, payment_date, description, received_by)
            VALUES (${member_id || null}, ${member_name || ''}, ${type}, ${amount}, ${payment_method || 'dinheiro'}, ${payment_date || new Date()}, ${description || ''}, ${req.user.id})
            RETURNING *
        `;

        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao registrar dízimo:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tithes', auth, async (req, res) => {
    try {
        const tithes = await sql`
            SELECT * FROM tithes 
            ORDER BY payment_date DESC
        `;
        res.json(tithes);
    } catch (error) {
        console.error('❌ Erro ao listar dízimos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tithes/summary', auth, async (req, res) => {
    try {
        const result = await sql`
            SELECT 
                type,
                COUNT(*) as count,
                SUM(amount) as total
            FROM tithes
            GROUP BY type
            ORDER BY type
        `;

        const total = result.reduce((sum, r) => sum + parseFloat(r.total), 0);

        res.json({
            by_type: result,
            total: total
        });
    } catch (error) {
        console.error('❌ Erro ao buscar resumo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE CONTAS =====
// ============================================

app.post('/api/bills', auth, async (req, res) => {
    try {
        const { description, category, amount, due_date, notes } = req.body;

        if (!description || !category || !amount || !due_date) {
            return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
        }

        const result = await sql`
            INSERT INTO bills (description, category, amount, due_date, notes, created_by)
            VALUES (${description}, ${category}, ${amount}, ${due_date}, ${notes || ''}, ${req.user.id})
            RETURNING *
        `;

        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar conta:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/bills', auth, async (req, res) => {
    try {
        const bills = await sql`
            SELECT * FROM bills 
            ORDER BY due_date ASC, paid ASC
        `;
        res.json(bills);
    } catch (error) {
        console.error('❌ Erro ao listar contas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/bills/:id/pay', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_date, payment_method } = req.body;

        const result = await sql`
            UPDATE bills SET 
                paid = true,
                payment_date = ${payment_date || new Date()},
                payment_method = ${payment_method || 'dinheiro'}
            WHERE id = ${id}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        res.json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao pagar conta:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/bills/:id', auth, async (req, res) => {
    try {
        await sql`DELETE FROM bills WHERE id = ${req.params.id}`;
        res.json({ message: 'Conta removida com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover conta:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/bills/summary', auth, async (req, res) => {
    try {
        const summary = await sql`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN paid = false THEN amount ELSE 0 END) as pending,
                SUM(CASE WHEN paid = true THEN amount ELSE 0 END) as paid_total,
                COUNT(CASE WHEN paid = false THEN 1 ELSE 0 END) as pending_count,
                COUNT(CASE WHEN paid = true THEN 1 ELSE 0 END) as paid_count
            FROM bills
        `;

        res.json({
            summary: summary[0]
        });
    } catch (error) {
        console.error('❌ Erro ao buscar resumo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE CARROSSEL =====
// ============================================

app.post('/api/carousel', auth, pastorOnly, upload.single('image'), async (req, res) => {
    try {
        const { title, subtitle, link } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Imagem é obrigatória' });
        }

        const image_base64 = req.file.buffer.toString('base64');

        const result = await sql`
            INSERT INTO carousel_images (title, subtitle, image_base64, link, order_position)
            VALUES (${title || ''}, ${subtitle || ''}, ${image_base64}, ${link || ''}, 
                (SELECT COALESCE(MAX(order_position), 0) + 1 FROM carousel_images))
            RETURNING *
        `;
        console.log('✅ Carrossel criado:', result[0]);
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar carrossel:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/carousel', async (req, res) => {
    try {
        const images = await sql`
            SELECT * FROM carousel_images WHERE active = true ORDER BY order_position, created_at
        `;
        res.json(images);
    } catch (error) {
        console.error('❌ Erro carrossel:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/carousel/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM carousel_images WHERE id = ${req.params.id}`;
        res.json({ message: 'Imagem removida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE CONFIGURAÇÕES =====
// ============================================

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await sql`SELECT * FROM site_settings`;
        const obj = {};
        settings.forEach(s => obj[s.key] = s.value);
        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/settings', auth, pastorOnly, async (req, res) => {
    try {
        const { key, value } = req.body;
        await sql`
            INSERT INTO site_settings (key, value) VALUES (${key}, ${value})
            ON CONFLICT (key) DO UPDATE SET value = ${value}
        `;
        res.json({ message: 'Configuração atualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== MERCADO PAGO - PIX =====
// ============================================

app.post('/api/create-pix-payment', async (req, res) => {
    try {
        const { amount, description, email, name, phone, cpf } = req.body;

        if (!process.env.MP_ACCESS_TOKEN || !PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }

        const valor = parseFloat(amount);
        if (isNaN(valor) || valor <= 0) {
            return res.status(400).json({ error: 'Valor inválido' });
        }

        const externalReference = `NJ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const paymentData = {
            body: {
                transaction_amount: valor,
                description: description || 'Pagamento NJ Cabuçu',
                payment_method_id: 'pix',
                payer: {
                    email: email || 'cliente@email.com',
                    first_name: name || 'Cliente',
                    phone: { number: phone || '' },
                    identification: { type: 'CPF', number: cpf || '12345678909' }
                },
                external_reference: externalReference,
                notification_url: `${process.env.PUBLIC_URL || 'https://igrejanjcabucurj.vercel.app'}/api/webhook`
            }
        };

        console.log('📝 Criando pagamento PIX...');
        const payment = await PaymentService.create(paymentData);
        console.log('✅ Pagamento criado:', payment.id);

        // ENVIA E-MAIL DE CONFIRMAÇÃO
        await sendPaymentConfirmationEmail({
            email: email,
            name: name,
            payment_id: payment.id,
            amount: valor,
            description: description || 'Pagamento NJ Cabuçu',
            status: payment.status,
            type: req.body.paymentType || 'donation'
        });

        const paymentLink = payment.point_of_interaction?.transaction_data?.ticket_url || 
                           `https://www.mercadopago.com.br/payments/${payment.id}`;

        res.json({
            payment_id: payment.id,
            status: payment.status,
            payment_link: paymentLink,
            external_reference: externalReference,
            qr_code: payment.point_of_interaction?.transaction_data?.qr_code || '',
            qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || ''
        });
    } catch (error) {
        console.error('❌ Erro MP PIX:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') });
    }
});

// ============================================
// ===== MERCADO PAGO - CARTÃO =====
// ============================================

app.post('/api/create-card-payment-fallback', async (req, res) => {
    try {
        const { amount, description, email, name, phone, cpf, card_number, card_expiry, card_cvv, installments } = req.body;

        if (!process.env.MP_ACCESS_TOKEN || !PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }

        const valor = parseFloat(amount);
        if (isNaN(valor) || valor <= 0) {
            return res.status(400).json({ error: 'Valor inválido' });
        }

        if (!card_number || card_number.length < 16) {
            return res.status(400).json({ error: 'Número do cartão inválido' });
        }
        if (!card_expiry || !card_expiry.includes('/')) {
            return res.status(400).json({ error: 'Data de validade inválida' });
        }
        if (!card_cvv || card_cvv.length < 3) {
            return res.status(400).json({ error: 'CVV inválido' });
        }

        const tokenData = {
            card_number: card_number.replace(/\s/g, ''),
            expiration_month: parseInt(card_expiry.split('/')[0]),
            expiration_year: parseInt('20' + card_expiry.split('/')[1]),
            security_code: card_cvv,
            cardholder: {
                name: name || 'Cliente',
                identification: {
                    type: 'CPF',
                    number: cpf || '12345678909'
                }
            }
        };

        console.log('🔄 Criando token do cartão...');
        
        const tokenResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
            },
            body: JSON.stringify(tokenData)
        });

        const tokenResult = await tokenResponse.json();
        
        if (tokenResult.error) {
            console.error('❌ Erro ao criar token:', tokenResult.error);
            return res.status(400).json({ error: 'Erro ao processar cartão: ' + (tokenResult.error.message || 'Dados inválidos') });
        }

        if (!tokenResult.id) {
            throw new Error('Não foi possível gerar o token do cartão');
        }

        console.log('✅ Token criado:', tokenResult.id);

        const paymentData = {
            body: {
                transaction_amount: valor,
                description: description || 'Pagamento NJ Cabuçu',
                payment_method_id: 'credit_card',
                installments: parseInt(installments) || 1,
                token: tokenResult.id,
                payer: {
                    email: email || 'cliente@email.com',
                    first_name: name || 'Cliente',
                    phone: { number: phone || '' },
                    identification: { type: 'CPF', number: cpf || '12345678909' }
                },
                external_reference: `NJ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                notification_url: `${process.env.PUBLIC_URL || 'https://igrejanjcabucurj.vercel.app'}/api/webhook`
            }
        };

        console.log('📝 Criando pagamento com cartão...');
        const payment = await PaymentService.create(paymentData);
        console.log('✅ Pagamento criado:', payment.id);

        // ENVIA E-MAIL DE CONFIRMAÇÃO
        await sendPaymentConfirmationEmail({
            email: email,
            name: name,
            payment_id: payment.id,
            amount: valor,
            description: description || 'Pagamento NJ Cabuçu',
            status: payment.status,
            type: req.body.paymentType || 'sale'
        });

        res.json({
            payment_id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            external_reference: payment.external_reference
        });
    } catch (error) {
        console.error('❌ Erro MP cartão:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') });
    }
});

// ============================================
// ===== WEBHOOK - ATUALIZA STATUS E ENVIA E-MAIL =====
// ============================================

app.post('/api/webhook', async (req, res) => {
    try {
        console.log('📝 Webhook recebido:', JSON.stringify(req.body, null, 2));
        
        const { data, type } = req.body;
        
        if (type === 'payment' && data && data.id) {
            const paymentId = data.id;
            console.log(`✅ Pagamento ${paymentId} confirmado!`);
            
            if (PaymentService) {
                try {
                    const payment = await PaymentService.get({ id: paymentId });
                    console.log('📊 Status do pagamento:', payment.status);
                    
                    const order = await sql`SELECT * FROM orders WHERE payment_id = ${paymentId}`;
                    const donation = await sql`SELECT * FROM donations WHERE payment_id = ${paymentId}`;
                    
                    const record = order[0] || donation[0];
                    
                    if (payment.status === 'approved') {
                        await sql`
                            UPDATE orders SET status = 'approved' WHERE payment_id = ${paymentId}
                        `;
                        await sql`
                            UPDATE donations SET status = 'approved' WHERE payment_id = ${paymentId}
                        `;
                        console.log('✅ Pagamento aprovado e registrado!');
                        
                        // ENVIA E-MAIL DE CONFIRMAÇÃO
                        if (record) {
                            await sendPaymentConfirmationEmail({
                                email: record.user_email || 'cliente@email.com',
                                name: record.user_name || 'Cliente',
                                payment_id: paymentId,
                                amount: record.total || record.amount || 0,
                                description: record.type || 'Pagamento NJ Cabuçu',
                                status: 'approved',
                                type: order[0] ? 'sale' : 'donation'
                            });
                        }
                    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
                        await sql`
                            UPDATE orders SET status = 'rejected' WHERE payment_id = ${paymentId}
                        `;
                        await sql`
                            UPDATE donations SET status = 'rejected' WHERE payment_id = ${paymentId}
                        `;
                        console.log('❌ Pagamento recusado/cancelado');
                    }
                } catch (error) {
                    console.error('❌ Erro ao buscar pagamento:', error);
                }
            }
        }
        
        res.json({ received: true });
    } catch (error) {
        console.error('❌ Erro webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== VERIFICAR STATUS DO PAGAMENTO =====
// ============================================

app.get('/api/check-payment/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        if (!PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }
        
        console.log('🔍 Verificando pagamento:', paymentId);
        const payment = await PaymentService.get({ id: paymentId });
        console.log('📊 Status:', payment.status);
        
        res.json({
            id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            external_reference: payment.external_reference
        });
    } catch (error) {
        console.error('❌ Erro ao verificar pagamento:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/payment-status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        if (!PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }
        
        console.log('🔍 Verificando pagamento (rota alternativa):', paymentId);
        const payment = await PaymentService.get({ id: paymentId });
        console.log('📊 Status:', payment.status);
        
        res.json({
            id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            external_reference: payment.external_reference
        });
    } catch (error) {
        console.error('❌ Erro ao verificar pagamento:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/update-payment-status', async (req, res) => {
    try {
        const { payment_id, status } = req.body;
        
        await sql`
            UPDATE orders SET status = ${status} WHERE payment_id = ${payment_id}
        `;
        await sql`
            UPDATE donations SET status = ${status} WHERE payment_id = ${payment_id}
        `;
        
        console.log(`✅ Status do pagamento ${payment_id} atualizado para ${status}`);
        res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTA DE TESTE DE E-MAIL =====
// ============================================

app.post('/api/test-email', async (req, res) => {
    try {
        const { email, name } = req.body;
        
        const result = await sendPaymentConfirmationEmail({
            email: email || 'mvini440@gmail.com',
            name: name || 'Cliente Teste',
            payment_id: 'TEST-123456',
            amount: 10.00,
            description: 'Teste de e-mail - NJ Cabuçu',
            status: 'approved',
            type: 'donation'
        });
        
        res.json({ 
            message: 'E-mail enviado com sucesso!', 
            messageId: result?.messageId 
        });
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== SERVE HTML =====
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/departamento', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'departamento.html'));
});

// ============================================
// ===== INICIAR =====
// ============================================

app.listen(PORT, () => {
    console.log('');
    console.log('🔥 NJ Cabuçu rodando na porta ' + PORT);
    console.log('🌐 ' + BASE_URL);
    console.log('');
    console.log('📋 Credenciais:');
    console.log('   Email: pastor@njcabucu.com');
    console.log('   Senha: admin123');
    console.log('');
    console.log('💰 Mercado Pago: ' + (process.env.MP_ACCESS_TOKEN ? '✅ Configurado' : '⚠️ Não configurado'));
    console.log('📧 E-mail: ' + (process.env.EMAIL_USER ? '✅ Configurado' : '⚠️ Não configurado'));
    console.log('');
});
