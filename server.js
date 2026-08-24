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
// ===== EMAIL (NODEMAILER) =====
// ============================================
let transporter = null;
try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Erro ao conectar email:', error.message);
            } else {
                console.log('✅ Email configurado e verificado!');
            }
        });
    } else {
        console.log('⚠️ Credenciais de email não configuradas');
    }
} catch (error) {
    console.log('⚠️ Erro email:', error.message);
}

// ============================================
// ===== FUNÇÃO PARA ENVIAR EMAIL =====
// ============================================
async function enviarEmailConfirmacao(dados) {
    console.log('📧 Tentando enviar email para:', dados.email);
    
    if (!transporter) {
        console.log('⚠️ Email não configurado. Salvando log...');
        try {
            const log = `[${new Date().toISOString()}] Email não enviado para ${dados.email}: ${JSON.stringify(dados)}\n`;
            fs.appendFileSync('email_log.txt', log);
        } catch (e) {}
        return false;
    }

    const { email, nome, tipo, valor, data, status, paymentId, detalhes } = dados;

    if (!email || !email.includes('@')) {
        console.log('⚠️ Email inválido:', email);
        return false;
    }

    const statusText = status === 'approved' ? '✅ APROVADO' : '⏳ PENDENTE';
    const statusColor = status === 'approved' ? '#28a745' : '#ffc107';
    const tiposLabels = {
        'dizimo': 'Dízimo',
        'oferta': 'Oferta',
        'missoes': 'Missões',
        'inscricao': 'Inscrição',
        'compra': 'Compra',
        'evento': 'Evento',
        'pagamento': 'Pagamento',
        'doacao': 'Doação'
    };
    const tipoLabel = tiposLabels[tipo] || tipo || 'Pagamento';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
            .header { background: #0D47A1; color: #fff; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0 0; opacity: 0.8; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
            .info-row:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #555; }
            .value { font-weight: 500; }
            .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: 700; background: ${statusColor}; color: #fff; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🙏 NJ Cabuçu</h1>
            <p>Comprovante de ${tipoLabel}</p>
        </div>
        <div class="content">
            <div style="text-align: center; margin-bottom: 20px;">
                <span class="status">${statusText}</span>
            </div>
            <div class="info-row">
                <span class="label">Nome</span>
                <span class="value">${nome || 'Não informado'}</span>
            </div>
            <div class="info-row">
                <span class="label">E-mail</span>
                <span class="value">${email || 'Não informado'}</span>
            </div>
            <div class="info-row">
                <span class="label">Valor</span>
                <span class="value">R$ ${parseFloat(valor || 0).toFixed(2)}</span>
            </div>
            <div class="info-row">
                <span class="label">Data</span>
                <span class="value">${new Date(data || Date.now()).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="info-row">
                <span class="label">ID do Pagamento</span>
                <span class="value">${paymentId || '-'}</span>
            </div>
            <div class="info-row">
                <span class="label">Tipo</span>
                <span class="value">${tipoLabel}</span>
            </div>
            ${detalhes ? `<div class="info-row"><span class="label">Detalhes</span><span class="value">${detalhes}</span></div>` : ''}
        </div>
        <div class="footer">
            <p>NJ Cabuçu - "E conhecereis a verdade, e a verdade vos libertará." (João 8:32)</p>
            <p>Este é um comprovante automático. Não é necessário responder.</p>
        </div>
    </body>
    </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: `"NJ Cabuçu" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `💰 Comprovante de ${tipoLabel} - NJ Cabuçu`,
            html: html,
            text: `Comprovante de ${tipoLabel}\n\nNome: ${nome}\nValor: R$ ${parseFloat(valor || 0).toFixed(2)}\nData: ${new Date(data || Date.now()).toLocaleDateString('pt-BR')}\nStatus: ${statusText}\nID: ${paymentId}`
        });
        console.log('✅ Email enviado para:', email, 'ID:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error.message);
        try {
            const log = `[${new Date().toISOString()}] ERRO ao enviar para ${email}: ${error.message}\nDados: ${JSON.stringify(dados)}\n\n`;
            fs.appendFileSync('email_log.txt', log);
        } catch (e) {}
        return false;
    }
}

// ============================================
// ===== APP =====
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

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
    limits: { 
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Apenas imagens (JPG, PNG, GIF, WEBP) e PDFs são permitidos!'));
        }
    }
});

// Middleware para upload de múltiplos arquivos (imagem + pdf)
const uploadFields = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 }
]);

// ============================================
// ===== FUNÇÕES DE AUTENTICAÇÃO =====
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

const leaderOnly = (req, res, next) => {
    if (req.user?.role !== 'lider' && req.user?.role !== 'pastor' && !req.user?.is_leader) {
        return res.status(403).json({ error: 'Apenas líderes' });
    }
    next();
};

// ============================================
// ===== INICIALIZAR BANCO =====
// ============================================
async function initDB() {
    console.log('📝 Criando/Verificando tabelas...');
    
    try {
        // USERS
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

        // DEPARTMENTS
        await sql`CREATE TABLE IF NOT EXISTS departments (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            leader_id INTEGER,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // DEPARTMENT MEMBERS
        await sql`CREATE TABLE IF NOT EXISTS department_members (
            department_id INTEGER,
            user_id INTEGER,
            role VARCHAR(50) DEFAULT 'membro',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (department_id, user_id)
        )`;

        await sql`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='department_members' AND column_name='role') THEN
                    ALTER TABLE department_members ADD COLUMN role VARCHAR(50) DEFAULT 'membro';
                END IF;
            END $$;
        `;

        // STUDIES
        await sql`CREATE TABLE IF NOT EXISTS studies (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            file_url VARCHAR(500),
            image_url VARCHAR(500),
            image_base64 TEXT,
            file_base64 TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // PRODUCTS
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

        // EVENTS
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

        // PRAYERS
        await sql`CREATE TABLE IF NOT EXISTS prayers (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            request TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // ORDERS
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

        // REGISTRATIONS
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

        // DONATIONS
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

        // CAROUSEL
        await sql`CREATE TABLE IF NOT EXISTS carousel_images (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200),
            subtitle VARCHAR(200),
            description TEXT,
            image_url VARCHAR(500),
            image_base64 TEXT,
            link VARCHAR(500),
            order_position INTEGER DEFAULT 0,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // SITE SETTINGS
        await sql`CREATE TABLE IF NOT EXISTS site_settings (
            id SERIAL PRIMARY KEY,
            key VARCHAR(100) UNIQUE NOT NULL,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // MEMBERS
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

        // ATTENDANCE
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

        // TITHES
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

        // BILLS
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

        // BAPTISM DATES
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

        // CÉLULAS
        await sql`CREATE TABLE IF NOT EXISTS celulas (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            lider_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            endereco TEXT,
            dias_reuniao VARCHAR(100),
            horario VARCHAR(50),
            descricao TEXT,
            is_active BOOLEAN DEFAULT true,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS celula_membros (
            id SERIAL PRIMARY KEY,
            celula_id INTEGER REFERENCES celulas(id) ON DELETE CASCADE,
            membro_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
            data_entrada DATE DEFAULT CURRENT_DATE,
            is_active BOOLEAN DEFAULT true,
            UNIQUE(celula_id, membro_id)
        )`;

        await sql`CREATE TABLE IF NOT EXISTS celula_estatisticas (
            id SERIAL PRIMARY KEY,
            celula_id INTEGER REFERENCES celulas(id) ON DELETE CASCADE,
            data_registro DATE DEFAULT CURRENT_DATE,
            total_membros INTEGER DEFAULT 0,
            batizados INTEGER DEFAULT 0,
            aceitaram_jesus INTEGER DEFAULT 0,
            visitantes INTEGER DEFAULT 0,
            novo_membros INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(celula_id, data_registro)
        )`;

        await sql`CREATE TABLE IF NOT EXISTS celula_decisoes (
            id SERIAL PRIMARY KEY,
            celula_id INTEGER REFERENCES celulas(id) ON DELETE CASCADE,
            membro_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
            tipo VARCHAR(20) NOT NULL,
            data_decisao DATE DEFAULT CURRENT_DATE,
            observacao TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // LIVES
        await sql`CREATE TABLE IF NOT EXISTS lives (
            id SERIAL PRIMARY KEY,
            titulo VARCHAR(200) NOT NULL,
            descricao TEXT,
            status VARCHAR(20) DEFAULT 'offline',
            stream_key VARCHAR(100) UNIQUE,
            iniciada_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
            started_at TIMESTAMP,
            ended_at TIMESTAMP,
            viewers INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        await sql`CREATE TABLE IF NOT EXISTS live_viewers (
            id SERIAL PRIMARY KEY,
            live_id INTEGER REFERENCES lives(id) ON DELETE CASCADE,
            viewer_id VARCHAR(100),
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            left_at TIMESTAMP
        )`;

        // REFLEXÕES
        await sql`CREATE TABLE IF NOT EXISTS pastor_reflections (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            link VARCHAR(500) NOT NULL,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // MÚSICAS
        await sql`CREATE TABLE IF NOT EXISTS songs (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            artist VARCHAR(100),
            key VARCHAR(10) DEFAULT 'C',
            lyrics TEXT,
            youtube_url VARCHAR(500),
            department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // ESCALAS
        await sql`CREATE TABLE IF NOT EXISTS worship_scales (
            id SERIAL PRIMARY KEY,
            department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
            event_date TIMESTAMP NOT NULL,
            leader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            minister_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            songs TEXT,
            song_ids TEXT,
            palette VARCHAR(200),
            rehearsal BOOLEAN DEFAULT false,
            musician_ids TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        // DISPONIBILIDADE
        await sql`CREATE TABLE IF NOT EXISTS availability (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, date)
        )`;

        await sql`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='availability' AND column_name='department_id') THEN
                    ALTER TABLE availability ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE;
                END IF;
            END $$;
        `;

        await sql`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='studies' AND column_name='file_base64') THEN
                    ALTER TABLE studies ADD COLUMN file_base64 TEXT;
                END IF;
            END $$;
        `;

        // Adicionar minister_id se não existir
        await sql`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='worship_scales' AND column_name='minister_id') THEN
                    ALTER TABLE worship_scales ADD COLUMN minister_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
                END IF;
            END $$;
        `;

        console.log('✅ Todas as tabelas verificadas/criadas');

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

app.get('/api/users/all', auth, async (req, res) => {
    try {
        const users = await sql`
            SELECT id, name, email, role, department_id, department_name, phone, first_login, is_leader, created_at
            FROM users 
            ORDER BY name
        `;
        res.json(users);
    } catch (error) {
        console.error('❌ Erro ao buscar todos os usuários:', error);
        res.status(500).json({ error: error.message });
    }
});

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

app.post('/api/users-by-leader', auth, async (req, res) => {
    try {
        const { name, email, password, role, department_id } = req.body;

        if (req.user.role !== 'lider' && req.user.role !== 'pastor' && !req.user.is_leader) {
            return res.status(403).json({ error: 'Apenas líderes podem criar usuários' });
        }

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
        }

        const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (existing.length > 0) {
            return res.status(400).json({ error: 'E-mail já cadastrado' });
        }

        const deptId = department_id || req.user.department_id;
        if (!deptId) {
            return res.status(400).json({ error: 'Departamento não informado' });
        }

        const dept = await sql`SELECT * FROM departments WHERE id = ${deptId} AND is_active = true`;
        if (dept.length === 0) {
            return res.status(404).json({ error: 'Departamento não encontrado' });
        }

        const hash = await hashPassword(password);
        const isLeader = (role === 'lider');

        let userRole = 'colaborador';
        if (role === 'lider') userRole = 'lider';
        else if (role === 'ministro') userRole = 'ministro';
        else if (role === 'musico') userRole = 'musico';
        else userRole = 'colaborador';

        const result = await sql`
            INSERT INTO users (name, email, password_hash, role, department_id, department_name, phone, first_login, is_leader)
            VALUES (${name}, ${email}, ${hash}, ${userRole}, ${deptId}, ${dept[0].name}, '', true, ${isLeader})
            RETURNING id, name, email, role, department_id, department_name, is_leader
        `;

        const memberRole = isLeader ? 'lider' : (role || 'membro');
        await sql`
            INSERT INTO department_members (department_id, user_id, role)
            VALUES (${deptId}, ${result[0].id}, ${memberRole})
            ON CONFLICT (department_id, user_id) DO UPDATE SET role = ${memberRole}
        `;

        if (isLeader) {
            await sql`
                UPDATE departments 
                SET leader_id = ${result[0].id} 
                WHERE id = ${deptId}
            `;
            console.log(`✅ ${name} definido como líder do departamento ${dept[0].name}`);
        }

        console.log(`✅ Usuário ${name} criado como ${memberRole} no departamento ${dept[0].name}`);

        res.status(201).json({ 
            success: true,
            message: 'Usuário criado com sucesso!',
            user: result[0],
            department_name: dept[0].name,
            member_role: memberRole
        });
    } catch (error) {
        console.error('❌ Erro ao criar usuário por líder:', error);
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
// ===== MEMBROS DO DEPARTAMENTO - CORRIGIDO =====
// ============================================

app.get('/api/departments/:id/members', auth, async (req, res) => {
    try {
        const deptId = req.params.id;
        console.log(`📝 Buscando membros do departamento ${deptId}`);
        
        // Verificar se o departamento existe
        const dept = await sql`SELECT * FROM departments WHERE id = ${deptId} AND is_active = true`;
        if (dept.length === 0) {
            return res.status(404).json({ error: 'Departamento não encontrado' });
        }

        // Buscar membros sem restrição de permissão
        const members = await sql`
            SELECT u.id, u.name, u.email, u.phone, u.role, u.is_leader, 
                   dm.role as member_role, dm.joined_at
            FROM users u
            JOIN department_members dm ON u.id = dm.user_id
            WHERE dm.department_id = ${deptId}
            ORDER BY u.name
        `;
        
        console.log(`✅ Encontrados ${members.length} membros`);
        res.json(members);
    } catch (error) {
        console.error('❌ Erro ao buscar membros:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/departments/:id/members', auth, async (req, res) => {
    try {
        const deptId = req.params.id;
        const { user_id, role } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id é obrigatório' });
        }

        const user = await sql`SELECT * FROM users WHERE id = ${user_id}`;
        if (user.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const dept = await sql`SELECT * FROM departments WHERE id = ${deptId} AND is_active = true`;
        if (dept.length === 0) {
            return res.status(404).json({ error: 'Departamento não encontrado' });
        }

        await sql`
            INSERT INTO department_members (department_id, user_id, role)
            VALUES (${deptId}, ${user_id}, ${role || 'membro'})
            ON CONFLICT (department_id, user_id) DO UPDATE SET role = ${role || 'membro'}
        `;

        await sql`
            UPDATE users SET department_id = ${deptId}, department_name = ${dept[0].name}
            WHERE id = ${user_id}
        `;

        if (role === 'lider') {
            await sql`UPDATE users SET is_leader = true WHERE id = ${user_id}`;
            await sql`UPDATE departments SET leader_id = ${user_id} WHERE id = ${deptId}`;
        } else {
            await sql`UPDATE users SET is_leader = false WHERE id = ${user_id}`;
            const currentLeader = await sql`SELECT leader_id FROM departments WHERE id = ${deptId}`;
            if (currentLeader.length > 0 && currentLeader[0].leader_id == user_id) {
                await sql`UPDATE departments SET leader_id = NULL WHERE id = ${deptId}`;
            }
        }

        res.status(201).json({ message: 'Membro adicionado com sucesso' });
    } catch (error) {
        console.error('Erro ao adicionar membro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/departments/:id/members/:userId', auth, async (req, res) => {
    try {
        const deptId = req.params.id;
        const userId = req.params.userId;
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({ error: 'role é obrigatório' });
        }

        const validRoles = ['membro', 'lider', 'ministro', 'musico', 'colaborador'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Função inválida' });
        }

        await sql`
            UPDATE department_members SET role = ${role}
            WHERE department_id = ${deptId} AND user_id = ${userId}
        `;

        if (role === 'lider') {
            await sql`UPDATE users SET is_leader = true WHERE id = ${userId}`;
            await sql`UPDATE departments SET leader_id = ${userId} WHERE id = ${deptId}`;
        } else {
            await sql`UPDATE users SET is_leader = false WHERE id = ${userId}`;
            const currentLeader = await sql`SELECT leader_id FROM departments WHERE id = ${deptId}`;
            if (currentLeader.length > 0 && currentLeader[0].leader_id == parseInt(userId)) {
                await sql`UPDATE departments SET leader_id = NULL WHERE id = ${deptId}`;
            }
        }

        res.json({ message: 'Função atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar função:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/departments/:id/members/:userId', auth, async (req, res) => {
    try {
        const deptId = req.params.id;
        const userId = req.params.userId;

        await sql`
            DELETE FROM department_members
            WHERE department_id = ${deptId} AND user_id = ${userId}
        `;

        const otherDepts = await sql`
            SELECT * FROM department_members WHERE user_id = ${userId}
        `;
        if (otherDepts.length === 0) {
            await sql`UPDATE users SET department_id = NULL, department_name = NULL, is_leader = false WHERE id = ${userId}`;
        }

        const currentLeader = await sql`SELECT leader_id FROM departments WHERE id = ${deptId}`;
        if (currentLeader.length > 0 && currentLeader[0].leader_id == parseInt(userId)) {
            await sql`UPDATE departments SET leader_id = NULL WHERE id = ${deptId}`;
        }

        res.json({ message: 'Membro removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover membro:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE MÚSICAS =====
// ============================================

app.get('/api/songs', auth, async (req, res) => {
    try {
        const { department_id } = req.query;
        let query = `SELECT * FROM songs`;
        const params = [];
        if (department_id) {
            query += ` WHERE department_id = $1`;
            params.push(department_id);
        }
        query += ` ORDER BY title`;
        const songs = await sql(query, params);
        res.json(songs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/songs', auth, async (req, res) => {
    try {
        const { title, artist, key, lyrics, youtube_url, department_id } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Título é obrigatório' });
        }

        const deptId = department_id || req.user.department_id;
        if (!deptId) {
            return res.status(400).json({ error: 'Departamento não informado' });
        }

        const result = await sql`
            INSERT INTO songs (title, artist, key, lyrics, youtube_url, department_id, created_by)
            VALUES (${title}, ${artist || ''}, ${key || 'C'}, ${lyrics || ''}, ${youtube_url || ''}, ${deptId}, ${req.user.id})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar música:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/songs/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await sql`DELETE FROM songs WHERE id = ${id}`;
        res.json({ message: 'Música removida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/songs/:id/chords', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { chords, key } = req.body;
        
        if (!chords) {
            return res.status(400).json({ error: 'Cifra é obrigatória' });
        }

        const song = await sql`SELECT * FROM songs WHERE id = ${id}`;
        if (song.length === 0) {
            return res.status(404).json({ error: 'Música não encontrada' });
        }

        const isLeader = req.user.role === 'lider' || req.user.role === 'pastor' || req.user.is_leader;
        if (!isLeader && song[0].created_by !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão para editar' });
        }

        await sql`
            UPDATE songs 
            SET lyrics = ${chords}, key = ${key || song[0].key || 'C'}
            WHERE id = ${id}
        `;
        
        res.json({ message: 'Cifra atualizada com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao salvar cifra:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/songs/by-key/:key', auth, async (req, res) => {
    try {
        const { key } = req.params;
        const { department_id } = req.query;
        
        let query = `SELECT * FROM songs WHERE key = $1`;
        const params = [key];
        
        if (department_id) {
            query += ` AND department_id = $2`;
            params.push(department_id);
        }
        
        query += ` ORDER BY title`;
        const songs = await sql(query, params);
        res.json(songs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE ESCALAS - CORRIGIDAS =====
// ============================================

app.post('/api/worship-scales', auth, async (req, res) => {
    try {
        const { department_id, event_date, leader_id, minister_id, songs, song_ids, palette, rehearsal, musicians } = req.body;

        if (!department_id || !event_date) {
            return res.status(400).json({ error: 'Departamento e data são obrigatórios' });
        }

        const songsJson = JSON.stringify(songs || []);
        const songIdsJson = JSON.stringify(song_ids || []);
        const musiciansJson = JSON.stringify(musicians || []);

        const result = await sql`
            INSERT INTO worship_scales (department_id, event_date, leader_id, minister_id, songs, song_ids, palette, rehearsal, musician_ids, created_by)
            VALUES (${department_id}, ${event_date}, ${leader_id || null}, ${minister_id || null}, ${songsJson}, ${songIdsJson}, ${palette || 'Azul, Prata, Branco, Dourado'}, ${rehearsal || false}, ${musiciansJson}, ${req.user.id})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar escala:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/worship-scales', auth, async (req, res) => {
    try {
        const { department_id } = req.query;
        console.log(`📝 Buscando escalas para departamento ${department_id || 'todos'}`);
        
        let query = `
            SELECT ws.*, 
                   u1.name as leader_name, 
                   u2.name as minister_name
            FROM worship_scales ws
            LEFT JOIN users u1 ON ws.leader_id = u1.id
            LEFT JOIN users u2 ON ws.minister_id = u2.id
        `;
        const params = [];
        if (department_id) {
            query += ` WHERE ws.department_id = $1`;
            params.push(department_id);
        } else if (req.user.department_id) {
            query += ` WHERE ws.department_id = $1`;
            params.push(req.user.department_id);
        }
        query += ` ORDER BY ws.event_date DESC`;
        
        const scales = await sql(query, params);
        console.log(`✅ Encontradas ${scales.length} escalas`);
        res.json(scales);
    } catch (error) {
        console.error('❌ Erro ao buscar escalas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/worship-scales/:id/details', auth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📝 Buscando detalhes da escala ${id}`);
        
        // Buscar escala com minister_name
        const scale = await sql`
            SELECT ws.*, 
                   u1.name as leader_name, 
                   u2.name as minister_name
            FROM worship_scales ws
            LEFT JOIN users u1 ON ws.leader_id = u1.id
            LEFT JOIN users u2 ON ws.minister_id = u2.id
            WHERE ws.id = ${id}
        `;
        
        if (scale.length === 0) {
            return res.status(404).json({ error: 'Escala não encontrada' });
        }

        let musicianIds = [];
        try {
            musicianIds = JSON.parse(scale[0].musician_ids || '[]');
        } catch { musicianIds = []; }
        let musicians = [];
        if (musicianIds.length > 0) {
            musicians = await sql`
                SELECT id, name, email FROM users WHERE id = ANY(${musicianIds})
            `;
        }

        let songIds = [];
        try {
            songIds = JSON.parse(scale[0].song_ids || '[]');
        } catch { songIds = []; }
        let songs = [];
        if (songIds.length > 0) {
            songs = await sql`
                SELECT id, title, key, lyrics FROM songs WHERE id = ANY(${songIds})
            `;
        }

        const result = { ...scale[0], musicians, songs };
        res.json(result);
    } catch (error) {
        console.error('❌ Erro ao buscar detalhes da escala:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/worship-scales/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await sql`DELETE FROM worship_scales WHERE id = ${id}`;
        res.json({ message: 'Escala removida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/worship-scales/member/:userId', auth, async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log(`📝 Buscando escalas para usuário ${userId}`);
        
        // Verificar se o usuário está buscando as próprias escalas
        if (parseInt(userId) !== req.user.id && req.user.role !== 'pastor' && !req.user.is_leader) {
            console.log(`⚠️ Usuário ${req.user.id} tentou acessar escalas de ${userId}`);
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const scales = await sql`
            SELECT ws.*, 
                   u1.name as leader_name, 
                   u2.name as minister_name
            FROM worship_scales ws
            LEFT JOIN users u1 ON ws.leader_id = u1.id
            LEFT JOIN users u2 ON ws.minister_id = u2.id
            WHERE ws.leader_id = ${userId} 
               OR ws.minister_id = ${userId}
               OR EXISTS (
                   SELECT 1 FROM json_array_elements_text(
                       COALESCE(ws.musician_ids::json, '[]'::json)
                   ) AS m_id
                   WHERE m_id::int = ${userId}
               )
            ORDER BY ws.event_date DESC
        `;
        console.log(`✅ Encontradas ${scales.length} escalas para o usuário`);
        res.json(scales);
    } catch (error) {
        console.error('❌ Erro ao buscar minhas escalas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/worship-scales/:id/songs', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { songs, song_ids } = req.body;

        const scale = await sql`SELECT * FROM worship_scales WHERE id = ${id}`;
        if (scale.length === 0) {
            return res.status(404).json({ error: 'Escala não encontrada' });
        }

        const isMinister = scale[0].minister_id === req.user.id;
        const isLeader = req.user.role === 'lider' || req.user.role === 'pastor' || req.user.is_leader;
        if (!isMinister && !isLeader) {
            return res.status(403).json({ error: 'Apenas o ministro ou líder podem editar as músicas' });
        }

        const songsJson = JSON.stringify(songs || []);
        const songIdsJson = JSON.stringify(song_ids || []);

        await sql`
            UPDATE worship_scales 
            SET songs = ${songsJson}, song_ids = ${songIdsJson}
            WHERE id = ${id}
        `;
        res.json({ message: 'Músicas atualizadas com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao atualizar músicas da escala:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE DISPONIBILIDADE =====
// ============================================

app.post('/api/availability', auth, async (req, res) => {
    try {
        console.log('📝 Recebendo requisição de disponibilidade:', req.body);
        
        const { user_id, date, department_id } = req.body;

        if (!user_id || !date) {
            console.log('❌ Campos obrigatórios faltando:', { user_id, date });
            return res.status(400).json({ error: 'Usuário e data são obrigatórios' });
        }

        let deptId = department_id || req.user.department_id;
        if (!deptId) {
            console.log('❌ Departamento não informado');
            return res.status(400).json({ error: 'Departamento não informado' });
        }

        const formattedDate = new Date(date).toISOString().split('T')[0];
        console.log('📅 Data formatada:', formattedDate);

        const existing = await sql`
            SELECT * FROM availability 
            WHERE user_id = ${user_id} AND date = ${formattedDate}
        `;

        if (existing.length > 0) {
            console.log('⚠️ Data já cadastrada:', formattedDate);
            return res.status(400).json({ error: 'Data já cadastrada' });
        }

        const result = await sql`
            INSERT INTO availability (user_id, date, department_id)
            VALUES (${user_id}, ${formattedDate}, ${deptId})
            RETURNING *
        `;
        
        console.log('✅ Disponibilidade salva com sucesso:', result[0]);
        res.status(201).json({ message: 'Disponibilidade adicionada', data: result[0] });
    } catch (error) {
        console.error('❌ Erro ao adicionar disponibilidade:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

app.get('/api/availability/:userId', auth, async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log(`📝 Buscando disponibilidade para usuário ${userId}`);
        
        if (parseInt(userId) !== req.user.id && req.user.role !== 'pastor' && !req.user.is_leader) {
            console.log(`⚠️ Usuário ${req.user.id} tentou acessar disponibilidade de ${userId}`);
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const availability = await sql`
            SELECT * FROM availability 
            WHERE user_id = ${userId} 
            ORDER BY date ASC
        `;
        console.log(`✅ Encontrados ${availability.length} registros de disponibilidade`);
        res.json(availability);
    } catch (error) {
        console.error('❌ Erro ao buscar disponibilidade:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/availability/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📝 Removendo disponibilidade ${id}`);
        
        await sql`DELETE FROM availability WHERE id = ${id}`;
        console.log('✅ Disponibilidade removida');
        res.json({ message: 'Disponibilidade removida' });
    } catch (error) {
        console.error('❌ Erro ao remover disponibilidade:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/availability/date/:date', auth, async (req, res) => {
    try {
        const { date } = req.params;
        const { department_id } = req.query;
        console.log(`📝 Buscando disponíveis para data ${date}, departamento ${department_id}`);

        const formattedDate = new Date(date).toISOString().split('T')[0];

        let query = `
            SELECT u.id, u.name, u.email 
            FROM availability a
            JOIN users u ON a.user_id = u.id
            WHERE DATE(a.date) = $1
        `;
        const params = [formattedDate];
        if (department_id) {
            query += ` AND a.department_id = $2`;
            params.push(department_id);
        }
        const available = await sql(query, params);
        console.log(`✅ Encontrados ${available.length} disponíveis`);
        res.json(available);
    } catch (error) {
        console.error('❌ Erro ao buscar disponíveis:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/availability/date/:date/department/:deptId', auth, async (req, res) => {
    try {
        const { date, deptId } = req.params;
        console.log(`📝 Buscando disponíveis para data ${date}, departamento ${deptId}`);

        const formattedDate = new Date(date).toISOString().split('T')[0];
        console.log(`📅 Data formatada: ${formattedDate}`);

        const available = await sql`
            SELECT u.id, u.name, u.email, u.phone, u.role, dm.role as member_role
            FROM availability a
            JOIN users u ON a.user_id = u.id
            JOIN department_members dm ON u.id = dm.user_id
            WHERE DATE(a.date) = $1 
            AND a.department_id = $2
            AND dm.department_id = $2
            ORDER BY u.name
        `;
        console.log(`✅ Encontrados ${available.length} membros disponíveis`);
        res.json(available);
    } catch (error) {
        console.error('❌ Erro ao buscar disponíveis:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTA DE ESTUDOS =====
// ============================================

app.post('/api/studies', auth, uploadFields, async (req, res) => {
    try {
        console.log('📝 Recebendo estudo...');
        console.log('📋 Body:', req.body);
        console.log('📎 Files:', req.files ? Object.keys(req.files) : 'Nenhum arquivo');
        
        const { title, description, file_url } = req.body;
        let image_base64 = null;
        let file_base64 = null;
        
        if (req.files && req.files.image && req.files.image.length > 0) {
            image_base64 = req.files.image[0].buffer.toString('base64');
            console.log('✅ Imagem processada com sucesso!');
        }
        
        if (req.files && req.files.file && req.files.file.length > 0) {
            file_base64 = req.files.file[0].buffer.toString('base64');
            console.log('✅ PDF processado com sucesso!');
        }

        if (!title || title.trim() === '') {
            console.log('❌ Título não informado');
            return res.status(400).json({ 
                success: false, 
                error: 'Título é obrigatório' 
            });
        }

        if (!image_base64 && !file_base64 && !file_url) {
            console.log('❌ Nenhum arquivo ou link enviado');
            return res.status(400).json({ 
                success: false, 
                error: 'Envie pelo menos uma imagem, PDF ou link' 
            });
        }

        const result = await sql`
            INSERT INTO studies (title, description, file_url, image_base64, file_base64)
            VALUES (
                ${title.trim()}, 
                ${description || ''}, 
                ${file_url || ''}, 
                ${image_base64 || ''},
                ${file_base64 || ''}
            )
            RETURNING id, title, description, file_url
        `;
        
        console.log('✅ Estudo criado com sucesso! ID:', result[0].id);
        
        res.status(201).json({ 
            success: true, 
            message: 'Estudo criado com sucesso!',
            study: result[0] 
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar estudo:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Erro interno do servidor'
        });
    }
});

app.get('/api/studies/:id/pdf', async (req, res) => {
    try {
        const { id } = req.params;
        const study = await sql`SELECT * FROM studies WHERE id = ${id}`;
        
        if (study.length === 0) {
            return res.status(404).json({ error: 'Estudo não encontrado' });
        }
        
        const s = study[0];
        
        if (s.file_base64) {
            const pdfBuffer = Buffer.from(s.file_base64, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${s.title || 'estudo'}.pdf"`);
            return res.send(pdfBuffer);
        }
        
        if (s.file_url) {
            return res.redirect(s.file_url);
        }
        
        res.status(404).json({ error: 'PDF não disponível para este estudo' });
    } catch (error) {
        console.error('❌ Erro ao baixar PDF:', error);
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
        
        console.log('📝 Criando pedido para:', user_email);
        
        const result = await sql`
            INSERT INTO orders (user_name, user_email, user_phone, items, total, payment_id, payment_method, status)
            VALUES (${user_name}, ${user_email}, ${user_phone || ''}, ${JSON.stringify(items)}, ${total}, ${payment_id}, ${payment_method}, ${status || 'pending'})
            RETURNING *
        `;
        
        const emailEnviado = await enviarEmailConfirmacao({
            email: user_email,
            nome: user_name,
            tipo: 'compra',
            valor: total,
            data: new Date(),
            status: status || 'pending',
            paymentId: payment_id,
            detalhes: `Items: ${items.map(i => i.name).join(', ')}`
        });
        
        if (emailEnviado) {
            console.log('✅ Email de confirmação enviado para:', user_email);
        } else {
            console.log('⚠️ Falha ao enviar email para:', user_email);
        }
        
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
            SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM orders WHERE status = 'approved'
        `;
        const salesByDay = await sql`
            SELECT 
                DATE(created_at) as date, 
                COUNT(*) as count, 
                COALESCE(SUM(total), 0) as total 
            FROM orders 
            WHERE created_at >= NOW() - INTERVAL '7 days' AND status = 'approved'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `;
        res.json({
            total: totalSales[0] || { count: 0, total: 0 },
            byDay: salesByDay || []
        });
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
        
        const tipoLabel = {
            baptism: 'Batismo',
            volunteer: 'Voluntário',
            event: 'Evento',
            department: 'Departamento'
        };
        await enviarEmailConfirmacao({
            email: email,
            nome: name,
            tipo: 'inscricao',
            valor: parseFloat(amount) || 0,
            data: new Date(),
            status: 'pending',
            paymentId: `REG-${result[0].id}`,
            detalhes: `Inscrição para ${tipoLabel[type] || type}\n${event_name ? 'Evento: ' + event_name : ''}\n${department_name ? 'Departamento: ' + department_name : ''}`
        });
        
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
        await sql`UPDATE registrations SET status = 'approved' WHERE id = ${req.params.id}`;
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
        
        console.log('📝 Registrando doação de:', user_email);
        
        const result = await sql`
            INSERT INTO donations (user_name, user_email, user_phone, type, amount, payment_id, payment_method, status)
            VALUES (${user_name}, ${user_email}, ${user_phone || ''}, ${type}, ${amount}, ${payment_id}, ${payment_method}, ${status || 'pending'})
            RETURNING *
        `;
        
        const emailEnviado = await enviarEmailConfirmacao({
            email: user_email,
            nome: user_name,
            tipo: type || 'doacao',
            valor: amount,
            data: new Date(),
            status: status || 'pending',
            paymentId: payment_id,
            detalhes: `Doação de ${type}`
        });
        
        if (emailEnviado) {
            console.log('✅ Email de confirmação enviado para:', user_email);
        }
        
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar doação:', error);
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
            SELECT id, name, birth_date, phone, department_name
            FROM members 
            WHERE is_active = true 
            AND EXTRACT(MONTH FROM birth_date) = ${currentMonth}
            ORDER BY EXTRACT(DAY FROM birth_date)
        `;
        res.json(birthdayMembers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE MEMBROS =====
// ============================================

app.post('/api/members', auth, async (req, res) => {
    try {
        const { name, email, phone, birth_date, marital_status, spouse_name, children, baptism_date, baptism_place, address, department_id, department_name, notes } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const result = await sql`
            INSERT INTO members (name, email, phone, birth_date, marital_status, spouse_name, children, baptism_date, baptism_place, address, department_id, department_name, notes, created_by)
            VALUES (${name}, ${email}, ${phone}, ${birth_date}, ${marital_status}, ${spouse_name}, ${children}, ${baptism_date}, ${baptism_place}, ${address}, ${department_id}, ${department_name}, ${notes}, ${req.user.id})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
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
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/members/:id', auth, async (req, res) => {
    try {
        await sql`UPDATE members SET is_active = false WHERE id = ${req.params.id}`;
        res.json({ message: 'Membro removido' });
    } catch (error) {
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
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE DÍZIMOS =====
// ============================================

app.post('/api/tithes', auth, async (req, res) => {
    try {
        const { member_id, member_name, type, amount, payment_method, payment_date, description } = req.body;
        
        console.log('📝 Registrando dízimo de:', member_name || 'Visitante');
        
        if (!type || !amount) {
            return res.status(400).json({ error: 'Tipo e valor são obrigatórios' });
        }

        const result = await sql`
            INSERT INTO tithes (member_id, member_name, type, amount, payment_method, payment_date, description, received_by)
            VALUES (${member_id || null}, ${member_name || ''}, ${type}, ${amount}, ${payment_method || 'dinheiro'}, ${payment_date || new Date()}, ${description || ''}, ${req.user.id})
            RETURNING *
        `;
        
        const user = await sql`SELECT email, name FROM users WHERE id = ${req.user.id}`;
        if (user.length > 0) {
            await enviarEmailConfirmacao({
                email: user[0].email,
                nome: user[0].name,
                tipo: type,
                valor: amount,
                data: new Date(),
                status: 'approved',
                paymentId: `TITHE-${result[0].id}`,
                detalhes: `${type} registrado por ${member_name || 'Visitante'}`
            });
        }
        
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao registrar dízimo:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tithes', auth, async (req, res) => {
    try {
        const tithes = await sql`SELECT * FROM tithes ORDER BY payment_date DESC`;
        res.json(tithes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tithes/summary', auth, async (req, res) => {
    try {
        const result = await sql`
            SELECT type, COUNT(*) as count, SUM(amount) as total
            FROM tithes
            GROUP BY type
        `;
        const total = result.reduce((sum, r) => sum + parseFloat(r.total), 0);
        res.json({ by_type: result, total });
    } catch (error) {
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
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/bills', auth, async (req, res) => {
    try {
        const bills = await sql`SELECT * FROM bills ORDER BY due_date ASC, paid ASC`;
        res.json(bills);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/bills/:id/pay', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_date, payment_method } = req.body;

        const result = await sql`
            UPDATE bills SET paid = true, payment_date = ${payment_date || new Date()}, payment_method = ${payment_method || 'dinheiro'}
            WHERE id = ${id}
            RETURNING *
        `;
        if (result.length === 0) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/bills/:id', auth, async (req, res) => {
    try {
        await sql`DELETE FROM bills WHERE id = ${req.params.id}`;
        res.json({ message: 'Conta removida' });
    } catch (error) {
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
        res.json({ summary: summary[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE CARROSSEL =====
// ============================================

app.post('/api/carousel', auth, pastorOnly, upload.single('image'), async (req, res) => {
    try {
        const { title, subtitle, description, link } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: 'Imagem é obrigatória' });
        }

        const image_base64 = req.file.buffer.toString('base64');

        const result = await sql`
            INSERT INTO carousel_images (title, subtitle, description, image_base64, link, order_position)
            VALUES (${title || ''}, ${subtitle || ''}, ${description || ''}, ${image_base64}, ${link || ''}, 
                (SELECT COALESCE(MAX(order_position), 0) + 1 FROM carousel_images))
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
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
// ===== ROTAS DE REFLEXÕES =====
// ============================================

app.get('/api/pastor-reflections', async (req, res) => {
    try {
        const reflections = await sql`
            SELECT r.*, u.name as created_by_name
            FROM pastor_reflections r
            LEFT JOIN users u ON r.created_by = u.id
            ORDER BY r.created_at DESC
        `;
        res.json(reflections);
    } catch (error) {
        console.error('❌ Erro ao buscar reflexões:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pastor-reflections', auth, pastorOnly, async (req, res) => {
    try {
        const { title, description, link } = req.body;
        if (!title || !link) {
            return res.status(400).json({ error: 'Título e link são obrigatórios' });
        }

        const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?]+)/;
        if (!youtubeRegex.test(link)) {
            return res.status(400).json({ error: 'Link inválido. Use um link do YouTube.' });
        }

        const result = await sql`
            INSERT INTO pastor_reflections (title, description, link, created_by)
            VALUES (${title}, ${description || ''}, ${link}, ${req.user.id})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao criar reflexão:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/pastor-reflections/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`DELETE FROM pastor_reflections WHERE id = ${req.params.id}`;
        res.json({ message: 'Reflexão removida' });
    } catch (error) {
        console.error('❌ Erro ao remover reflexão:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE CÉLULAS =====
// ============================================

app.post('/api/celulas', auth, pastorOnly, async (req, res) => {
    try {
        const { nome, lider_id, endereco, dias_reuniao, horario, descricao } = req.body;
        if (!nome) return res.status(400).json({ error: 'Nome da célula é obrigatório' });

        const result = await sql`
            INSERT INTO celulas (nome, lider_id, endereco, dias_reuniao, horario, descricao, created_by)
            VALUES (${nome}, ${lider_id || null}, ${endereco || ''}, ${dias_reuniao || ''}, ${horario || ''}, ${descricao || ''}, ${req.user.id})
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/celulas', async (req, res) => {
    try {
        const celulas = await sql`
            SELECT 
                c.*,
                u.name as lider_nome,
                COUNT(cm.id) as total_membros,
                (SELECT COUNT(*) FROM celula_membros cm2 WHERE cm2.celula_id = c.id AND cm2.is_active = true) as membros_ativos,
                (SELECT COUNT(*) FROM celula_decisoes cd WHERE cd.celula_id = c.id AND cd.tipo = 'batismo') as batizados,
                (SELECT COUNT(*) FROM celula_decisoes cd WHERE cd.celula_id = c.id AND cd.tipo = 'decisao') as decisoes
            FROM celulas c
            LEFT JOIN users u ON c.lider_id = u.id
            LEFT JOIN celula_membros cm ON c.id = cm.celula_id AND cm.is_active = true
            WHERE c.is_active = true
            GROUP BY c.id, u.name
            ORDER BY c.nome
        `;
        res.json(celulas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/celulas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const celula = await sql`
            SELECT c.*, u.name as lider_nome, u.phone as lider_telefone, u.email as lider_email
            FROM celulas c
            LEFT JOIN users u ON c.lider_id = u.id
            WHERE c.id = ${id} AND c.is_active = true
        `;
        if (celula.length === 0) return res.status(404).json({ error: 'Célula não encontrada' });
        
        const membros = await sql`
            SELECT m.id, m.name, m.phone, m.email, cm.data_entrada
            FROM celula_membros cm
            JOIN members m ON cm.membro_id = m.id
            WHERE cm.celula_id = ${id} AND cm.is_active = true
            ORDER BY m.name
        `;
        
        const decisoes = await sql`
            SELECT cd.*, m.name as membro_nome
            FROM celula_decisoes cd
            LEFT JOIN members m ON cd.membro_id = m.id
            WHERE cd.celula_id = ${id}
            ORDER BY cd.data_decisao DESC
            LIMIT 20
        `;
        
        res.json({ ...celula[0], membros, decisoes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/celulas/:id', auth, pastorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, lider_id, endereco, dias_reuniao, horario, descricao } = req.body;
        
        const result = await sql`
            UPDATE celulas 
            SET nome = COALESCE(${nome}, nome), lider_id = COALESCE(${lider_id}, lider_id),
                endereco = COALESCE(${endereco}, endereco), dias_reuniao = COALESCE(${dias_reuniao}, dias_reuniao),
                horario = COALESCE(${horario}, horario), descricao = COALESCE(${descricao}, descricao)
            WHERE id = ${id}
            RETURNING *
        `;
        if (result.length === 0) return res.status(404).json({ error: 'Célula não encontrada' });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/celulas/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`UPDATE celulas SET is_active = false WHERE id = ${req.params.id}`;
        res.json({ message: 'Célula removida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/celulas/:id/membros', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { membro_id } = req.body;
        if (!membro_id) return res.status(400).json({ error: 'Membro é obrigatório' });
        
        await sql`
            INSERT INTO celula_membros (celula_id, membro_id)
            VALUES (${id}, ${membro_id})
            ON CONFLICT (celula_id, membro_id) DO UPDATE SET is_active = true, data_entrada = CURRENT_DATE
        `;
        
        await atualizarEstatisticasCelula(id);
        res.json({ message: 'Membro adicionado à célula' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/celulas/:id/membros/:membro_id', auth, async (req, res) => {
    try {
        const { id, membro_id } = req.params;
        await sql`
            UPDATE celula_membros SET is_active = false 
            WHERE celula_id = ${id} AND membro_id = ${membro_id}
        `;
        await atualizarEstatisticasCelula(id);
        res.json({ message: 'Membro removido da célula' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/celulas/:id/decisoes', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { membro_id, tipo, observacao } = req.body;
        if (!tipo || !['batismo', 'decisao'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo inválido. Use "batismo" ou "decisao"' });
        }
        
        const result = await sql`
            INSERT INTO celula_decisoes (celula_id, membro_id, tipo, observacao)
            VALUES (${id}, ${membro_id || null}, ${tipo}, ${observacao || ''})
            RETURNING *
        `;
        await atualizarEstatisticasCelula(id);
        res.status(201).json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function atualizarEstatisticasCelula(celula_id) {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const membros = await sql`
            SELECT COUNT(*) as total FROM celula_membros 
            WHERE celula_id = ${celula_id} AND is_active = true
        `;
        const batizados = await sql`
            SELECT COUNT(*) as total FROM celula_decisoes 
            WHERE celula_id = ${celula_id} AND tipo = 'batismo' 
            AND data_decisao >= CURRENT_DATE - INTERVAL '30 days'
        `;
        const decisoes = await sql`
            SELECT COUNT(*) as total FROM celula_decisoes 
            WHERE celula_id = ${celula_id} AND tipo = 'decisao' 
            AND data_decisao >= CURRENT_DATE - INTERVAL '30 days'
        `;
        await sql`
            INSERT INTO celula_estatisticas (celula_id, data_registro, total_membros, batizados, aceitaram_jesus)
            VALUES (${celula_id}, ${hoje}, ${membros[0].total}, ${batizados[0].total}, ${decisoes[0].total})
            ON CONFLICT (celula_id, data_registro) 
            DO UPDATE SET total_membros = ${membros[0].total}, batizados = ${batizados[0].total}, aceitaram_jesus = ${decisoes[0].total}
        `;
    } catch (error) {
        console.error('❌ Erro ao atualizar estatísticas:', error);
    }
}

// ============================================
// ===== ROTAS DE LIVES =====
// ============================================

app.post('/api/lives/start', auth, async (req, res) => {
    try {
        const { titulo, descricao } = req.body;
        if (req.user.role !== 'pastor') {
            return res.status(403).json({ error: 'Apenas o pastor pode iniciar uma transmissão ao vivo.' });
        }

        const activeLive = await sql`SELECT * FROM lives WHERE status = 'live'`;
        if (activeLive.length > 0) {
            return res.status(400).json({ error: 'Já existe uma live ativa' });
        }

        const streamKey = 'live_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

        const result = await sql`
            INSERT INTO lives (titulo, descricao, status, stream_key, iniciada_por, started_at)
            VALUES (${titulo || 'Live NJ Cabuçu'}, ${descricao || ''}, 'live', ${streamKey}, ${req.user.id}, NOW())
            RETURNING *
        `;
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao iniciar live:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/lives/end/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const live = await sql`SELECT * FROM lives WHERE id = ${id}`;
        if (live.length === 0) return res.status(404).json({ error: 'Live não encontrada' });
        if (live[0].status === 'ended') return res.status(400).json({ error: 'Live já foi encerrada' });

        await sql`UPDATE lives SET status = 'ended', ended_at = NOW() WHERE id = ${id}`;
        res.json({ message: 'Live encerrada com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/lives/active', async (req, res) => {
    try {
        const live = await sql`
            SELECT l.*, u.name as iniciada_por_nome
            FROM lives l
            LEFT JOIN users u ON l.iniciada_por = u.id
            WHERE l.status = 'live'
            ORDER BY l.started_at DESC
            LIMIT 1
        `;
        if (live.length === 0) return res.json({ status: 'offline', message: 'Nenhuma live ativa' });
        res.json(live[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/lives/history', auth, async (req, res) => {
    try {
        const lives = await sql`
            SELECT l.*, u.name as iniciada_por_nome
            FROM lives l
            LEFT JOIN users u ON l.iniciada_por = u.id
            WHERE l.status != 'offline'
            ORDER BY l.created_at DESC
            LIMIT 50
        `;
        res.json(lives);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/lives/:id/viewer', async (req, res) => {
    try {
        const { id } = req.params;
        const { viewer_id } = req.body;

        await sql`
            INSERT INTO live_viewers (live_id, viewer_id)
            VALUES (${id}, ${viewer_id || 'anonymous_' + Date.now()})
            ON CONFLICT (live_id, viewer_id) DO NOTHING
        `;

        const count = await sql`
            SELECT COUNT(*) as total FROM live_viewers 
            WHERE live_id = ${id} AND left_at IS NULL
        `;

        await sql`UPDATE lives SET viewers = ${count[0].total} WHERE id = ${id}`;
        res.json({ viewers: count[0].total });
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
        
        if (!obj.cultos) {
            obj.cultos = JSON.stringify([
                { dia: 0, hora: 18, minuto: 0, label: 'Domingo 18:00' },
                { dia: 3, hora: 20, minuto: 0, label: 'Quarta 20:00' },
                { dia: 2, hora: 9, minuto: 0, label: 'Terça 09:00' }
            ]);
        }
        if (!obj.primary_color) obj.primary_color = '#0D47A1';
        if (!obj.site_title) obj.site_title = 'NJ Cabuçu';
        if (!obj.whatsapp) obj.whatsapp = '5521985345627';
        if (!obj.about_mission) obj.about_mission = 'Levar o amor de Deus a todas as pessoas, através da palavra, do louvor e da comunhão.';
        if (!obj.about_vision) obj.about_vision = 'Ser uma igreja relevante, que transforma vidas e impacta a comunidade com o evangelho.';
        if (!obj.about_values) obj.about_values = 'Amor, fé, esperança, serviço e comunhão. Vivemos os valores do Reino de Deus.';
        
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
// ===== ROTAS DE MERCADO PAGO =====
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

        const payment = await PaymentService.create(paymentData);
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
                identification: { type: 'CPF', number: cpf || '12345678909' }
            }
        };

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
            const testToken = 'test_' + Date.now();
            return await processCardPayment(testToken, valor, description, email, name, phone, cpf, installments, res);
        }

        return await processCardPayment(tokenResult.id, valor, description, email, name, phone, cpf, installments, res);
    } catch (error) {
        console.error('❌ Erro MP cartão:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') });
    }
});

async function processCardPayment(token, valor, description, email, name, phone, cpf, installments, res) {
    try {
        const paymentData = {
            body: {
                transaction_amount: valor,
                description: description || 'Pagamento NJ Cabuçu',
                payment_method_id: 'credit_card',
                installments: parseInt(installments) || 1,
                token: token,
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

        const payment = await PaymentService.create(paymentData);
        if (payment.status === 'approved') {
            await enviarEmailConfirmacao({
                email: email,
                nome: name,
                tipo: 'pagamento_cartao',
                valor: valor,
                data: new Date(),
                status: 'approved',
                paymentId: payment.id,
                detalhes: 'Pagamento com Cartão de Crédito'
            });
        }
        res.json({
            payment_id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            external_reference: payment.external_reference
        });
    } catch (error) {
        console.error('❌ Erro ao processar pagamento:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') });
    }
}

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
                    if (payment.status === 'approved') {
                        await sql`
                            UPDATE orders SET status = 'approved' WHERE payment_id = ${paymentId}
                        `;
                        await sql`
                            UPDATE donations SET status = 'approved' WHERE payment_id = ${paymentId}
                        `;
                        const orders = await sql`SELECT * FROM orders WHERE payment_id = ${paymentId}`;
                        const donations = await sql`SELECT * FROM donations WHERE payment_id = ${paymentId}`;
                        const item = orders[0] || donations[0];
                        if (item) {
                            await enviarEmailConfirmacao({
                                email: item.user_email || 'cliente@email.com',
                                nome: item.user_name || 'Cliente',
                                tipo: item.type || 'pagamento',
                                valor: item.amount || item.total || 0,
                                data: new Date(),
                                status: 'approved',
                                paymentId: paymentId,
                                detalhes: 'Pagamento confirmado via webhook'
                            });
                        }
                        console.log('✅ Pagamento aprovado e email enviado!');
                    }
                } catch (error) {
                    console.error('❌ Erro:', error);
                }
            }
        }
        res.json({ received: true });
    } catch (error) {
        console.error('❌ Erro webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/check-payment/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        if (!PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }
        const payment = await PaymentService.get({ id: paymentId });
        if (payment.status === 'approved') {
            const orders = await sql`SELECT * FROM orders WHERE payment_id = ${paymentId}`;
            const donations = await sql`SELECT * FROM donations WHERE payment_id = ${paymentId}`;
            const item = orders[0] || donations[0];
            if (item) {
                await enviarEmailConfirmacao({
                    email: item.user_email || 'cliente@email.com',
                    nome: item.user_name || 'Cliente',
                    tipo: item.type || 'pagamento',
                    valor: item.amount || item.total || 0,
                    data: new Date(),
                    status: 'approved',
                    paymentId: paymentId,
                    detalhes: 'Pagamento confirmado'
                });
            }
        }
        res.json({
            id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail
        });
    } catch (error) {
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
        if (status === 'approved') {
            const orders = await sql`SELECT * FROM orders WHERE payment_id = ${payment_id}`;
            const donations = await sql`SELECT * FROM donations WHERE payment_id = ${payment_id}`;
            const item = orders[0] || donations[0];
            if (item) {
                await enviarEmailConfirmacao({
                    email: item.user_email || 'cliente@email.com',
                    nome: item.user_name || 'Cliente',
                    tipo: item.type || 'pagamento',
                    valor: item.amount || item.total || 0,
                    data: new Date(),
                    status: 'approved',
                    paymentId: payment_id,
                    detalhes: 'Pagamento confirmado'
                });
            }
        }
        res.json({ message: 'Status atualizado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== ROTAS DE YOUTUBE E TRANSPOSIÇÃO =====
// ============================================

app.post('/api/youtube-song', auth, async (req, res) => {
    try {
        const { url } = req.body;
        
        const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?]+)/;
        const match = url.match(youtubeRegex);
        
        if (!match) {
            return res.status(400).json({ error: 'Link do YouTube inválido' });
        }
        
        const videoId = match[1];
        
        res.json({
            video_id: videoId,
            embed_url: `https://www.youtube.com/embed/${videoId}`,
            watch_url: `https://www.youtube.com/watch?v=${videoId}`
        });
    } catch (error) {
        console.error('❌ Erro ao buscar música do YouTube:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/transpose-chord', auth, async (req, res) => {
    try {
        const { lyrics, fromKey, toKey } = req.body;
        
        if (!lyrics || !fromKey || !toKey) {
            return res.status(400).json({ error: 'Dados incompletos para transposição' });
        }
        
        const transposed = transposeChords(lyrics, fromKey, toKey);
        res.json({ transposed });
    } catch (error) {
        console.error('❌ Erro na transposição:', error);
        res.status(500).json({ error: error.message });
    }
});

function transposeChords(lyrics, fromKey, toKey) {
    const chordMap = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    
    const chordNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const from = chordMap[fromKey];
    const to = chordMap[toKey];
    
    if (from === undefined || to === undefined) {
        return lyrics;
    }
    
    const diff = (to - from + 12) % 12;
    
    const chordRegex = /([A-G][#b]?)(maj|m|min|dim|aug|sus|add|\d|\(|\)|)?/g;
    
    return lyrics.replace(chordRegex, (match, chord, suffix) => {
        const baseIndex = chordMap[chord];
        if (baseIndex === undefined) return match;
        
        const newIndex = (baseIndex + diff) % 12;
        const newChord = chordNames[newIndex];
        
        return newChord + (suffix || '');
    });
}

// ============================================
// ===== COMPARTILHAR ESCALA NO WHATSAPP =====
// ============================================

app.get('/api/worship-scales/:id/share', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const scale = await sql`
            SELECT ws.*, 
                   u1.name as leader_name, 
                   u2.name as minister_name,
                   u3.name as created_by_name
            FROM worship_scales ws
            LEFT JOIN users u1 ON ws.leader_id = u1.id
            LEFT JOIN users u2 ON ws.minister_id = u2.id
            LEFT JOIN users u3 ON ws.created_by = u3.id
            WHERE ws.id = ${id}
        `;
        
        if (scale.length === 0) {
            return res.status(404).json({ error: 'Escala não encontrada' });
        }
        
        const s = scale[0];
        const eventDate = new Date(s.event_date);
        
        let songs = [];
        try {
            songs = JSON.parse(s.songs || '[]');
        } catch { songs = []; }
        
        let musicianIds = [];
        try {
            musicianIds = JSON.parse(s.musician_ids || '[]');
        } catch { musicianIds = []; }
        
        let musicians = [];
        if (musicianIds.length > 0) {
            musicians = await sql`
                SELECT name FROM users WHERE id = ANY(${musicianIds})
            `;
        }
        
        let message = `🎵 *ESCALA DE LOUVOR* 🎵\n\n`;
        message += `📅 *Data:* ${eventDate.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}\n`;
        message += `🕐 *Horário:* ${eventDate.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}\n\n`;
        message += `👑 *Líder:* ${s.leader_name || 'Não definido'}\n`;
        message += `🎤 *Ministro:* ${s.minister_name || 'Não definido'}\n\n`;
        
        if (songs.length > 0) {
            message += `🎶 *MÚSICAS:*\n`;
            songs.forEach((song, i) => {
                message += `${i+1}. ${song}\n`;
            });
            message += `\n`;
        }
        
        if (s.palette) {
            message += `🎨 *Paleta:* ${s.palette}\n\n`;
        }
        
        if (s.rehearsal) {
            message += `🎤 *Com ensaio*\n\n`;
        }
        
        if (musicians.length > 0) {
            message += `🎸 *Músicos:*\n`;
            musicians.forEach(m => {
                message += `- ${m.name}\n`;
            });
            message += `\n`;
        }
        
        message += `\n🙏 *"Cantai ao Senhor um novo cântico!"* (Salmo 96:1)`;
        
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
        
        res.json({ 
            message, 
            whatsapp_url: whatsappUrl,
            scale: s
        });
    } catch (error) {
        console.error('❌ Erro ao gerar compartilhamento:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== PDF DE INSCRIÇÃO =====
// ============================================

app.get('/api/registration-pdf/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const reg = await sql`SELECT * FROM registrations WHERE id = ${id}`;
        if (reg.length === 0) return res.status(404).json({ error: 'Não encontrado' });
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Comprovante</title></head>
        <body style="font-family:Arial;max-width:600px;margin:2rem auto;padding:2rem;">
            <h1 style="color:#0D47A1;">🙏 NJ Cabuçu</h1>
            <h2>Comprovante de Inscrição</h2>
            <p><strong>Protocolo:</strong> #${String(reg[0].id).padStart(6, '0')}</p>
            <p><strong>Nome:</strong> ${reg[0].name}</p>
            <p><strong>Email:</strong> ${reg[0].email || '-'}</p>
            <p><strong>Telefone:</strong> ${reg[0].phone || '-'}</p>
            ${reg[0].event_name ? `<p><strong>Evento:</strong> ${reg[0].event_name}</p>` : ''}
            ${reg[0].department_name ? `<p><strong>Departamento:</strong> ${reg[0].department_name}</p>` : ''}
            <p><strong>Status:</strong> ${reg[0].status === 'approved' ? '✅ Confirmado' : '⏳ Pendente'}</p>
            <hr>
            <p style="color:#888;font-size:0.8rem;">NJ Cabuçu - João 8:32</p>
        </body>
        </html>
        `;
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
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
    console.log('📋 Credenciais: pastor@njcabucu.com / admin123');
    console.log('');
    console.log('💰 Mercado Pago: ' + (process.env.MP_ACCESS_TOKEN ? '✅ Configurado' : '⚠️ Não configurado'));
    console.log('📧 Email: ' + (transporter ? '✅ Configurado' : '⚠️ Não configurado'));
    console.log('📹 Sistema de Live: ✅ Configurado');
    console.log('🎥 Reflexões do Pastor: ✅ Configurado');
    console.log('⏰ Horários dos Cultos: ✅ Configurado via site_settings');
    console.log('🎵 Módulo Louvor: ✅ Configurado');
    console.log('🙏 Módulo Oração: ✅ Configurado');
    console.log('📅 Módulo Secretaria: ✅ Configurado');
    console.log('💰 Módulo Tesouraria: ✅ Configurado');
    console.log('📋 Módulo de Disponibilidade: ✅ Configurado');
    console.log('');
});
