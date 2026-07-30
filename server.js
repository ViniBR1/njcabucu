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
            options: { timeout: 10000 }
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
const BASE_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

app.use(cors());
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

        // STUDIES
        await sql`CREATE TABLE IF NOT EXISTS studies (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            file_url VARCHAR(500),
            image_url VARCHAR(500),
            image_base64 TEXT,
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

        // ORDERS (VENDAS)
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

        // WORSHIP SCALES
        await sql`CREATE TABLE IF NOT EXISTS worship_scales (
            id SERIAL PRIMARY KEY,
            department_id INTEGER,
            event_date TIMESTAMP NOT NULL,
            leader_id INTEGER,
            songs TEXT[],
            palette TEXT,
            rehearsal BOOLEAN DEFAULT FALSE,
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

        // ===== TABELAS DE MEMBROS E SECRETARIA =====
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
// ===== ROTAS =====
// ============================================

// ----- LOGIN -----
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

// ----- USUÁRIOS E COLABORADORES -----
app.post('/api/users', auth, pastorOnly, async (req, res) => {
    try {
        const { name, email, password, role, department_name, phone, is_leader, department_id } = req.body;
        const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (existing.length > 0) return res.status(400).json({ error: 'Usuário já existe' });

        const hash = await hashPassword(password || '123456');
        
        let deptId = department_id || null;
        let deptName = department_name || '';
        
        if (!deptId && deptName) {
            const newDept = await sql`
                INSERT INTO departments (name, description)
                VALUES (${deptName}, 'Departamento de ${deptName}')
                RETURNING id
            `;
            deptId = newDept[0].id;
        }
        
        const result = await sql`
            INSERT INTO users (name, email, password_hash, role, department_id, department_name, phone, first_login, is_leader)
            VALUES (${name}, ${email}, ${hash}, ${role || 'colaborador'}, ${deptId}, ${deptName}, ${phone || ''}, true, ${is_leader || false})
            RETURNING id, name, email, role, department_id, department_name, is_leader
        `;
        
        if (is_leader && deptId) {
            await sql`
                INSERT INTO department_members (department_id, user_id, role)
                VALUES (${deptId}, ${result[0].id}, 'lider')
                ON CONFLICT (department_id, user_id) DO UPDATE SET role = 'lider'
            `;
            await sql`
                UPDATE departments SET leader_id = ${result[0].id} WHERE id = ${deptId}
            `;
        } else if (deptId) {
            await sql`
                INSERT INTO department_members (department_id, user_id, role)
                VALUES (${deptId}, ${result[0].id}, 'membro')
                ON CONFLICT (department_id, user_id) DO NOTHING
            `;
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

// ----- DEPARTAMENTOS -----
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

app.delete('/api/departments/:id', auth, pastorOnly, async (req, res) => {
    try {
        await sql`UPDATE departments SET is_active = false WHERE id = ${req.params.id}`;
        res.json({ message: 'Departamento removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/departments/:id/members', auth, async (req, res) => {
    try {
        const members = await sql`
            SELECT u.id, u.name, u.email, u.role, u.is_leader, dm.role as member_role
            FROM users u
            INNER JOIN department_members dm ON u.id = dm.user_id
            WHERE dm.department_id = ${req.params.id}
            ORDER BY dm.role DESC, u.name
        `;
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/departments/:id/members', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, role } = req.body;
        
        const user = await sql`SELECT * FROM users WHERE id = ${user_id}`;
        if (user.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        await sql`
            INSERT INTO department_members (department_id, user_id, role)
            VALUES (${id}, ${user_id}, ${role || 'membro'})
            ON CONFLICT (department_id, user_id) DO UPDATE SET role = ${role || 'membro'}
        `;
        
        await sql`
            UPDATE users SET department_id = ${id}, is_leader = ${role === 'lider' ? true : false}
            WHERE id = ${user_id}
        `;
        
        if (role === 'lider') {
            await sql`UPDATE departments SET leader_id = ${user_id} WHERE id = ${id}`;
        }
        
        res.json({ message: 'Membro adicionado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao adicionar membro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/departments/:department_id/members/:user_id', auth, async (req, res) => {
    try {
        const { department_id, user_id } = req.params;
        
        await sql`
            DELETE FROM department_members WHERE department_id = ${department_id} AND user_id = ${user_id}
        `;
        
        await sql`
            UPDATE users SET department_id = NULL, is_leader = false WHERE id = ${user_id}
        `;
        
        await sql`UPDATE departments SET leader_id = NULL WHERE id = ${department_id} AND leader_id = ${user_id}`;
        
        res.json({ message: 'Membro removido com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- ESTUDOS -----
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

// ----- PRODUTOS -----
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

app.put('/api/products/:id', auth, pastorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, stock, category } = req.body;
        const result = await sql`
            UPDATE products SET name = ${name}, description = ${description}, price = ${parseFloat(price)}, 
                stock = ${parseInt(stock) || 0}, category = ${category || ''}
            WHERE id = ${id}
            RETURNING *
        `;
        res.json(result[0]);
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

// ----- EVENTOS -----
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

app.put('/api/events/:id', auth, pastorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, date, price } = req.body;
        const result = await sql`
            UPDATE events SET title = ${title}, description = ${description}, 
                date = ${date}, price = ${parseFloat(price) || 0}
            WHERE id = ${id}
            RETURNING *
        `;
        res.json(result[0]);
    } catch (error) {
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

// ----- ORAÇÕES -----
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

// ----- PEDIDOS (VENDAS) -----
app.post('/api/orders', async (req, res) => {
    try {
        const { user_name, user_email, user_phone, items, total, payment_id, payment_method } = req.body;
        const result = await sql`
            INSERT INTO orders (user_name, user_email, user_phone, items, total, payment_id, payment_method)
            VALUES (${user_name}, ${user_email}, ${user_phone || ''}, ${JSON.stringify(items)}, ${total}, ${payment_id}, ${payment_method})
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
        console.log('📦 Total de vendas:', orders.length);
        res.json(orders);
    } catch (error) {
        console.error('❌ Erro ao buscar vendas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/orders/:id/status', auth, pastorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
        res.json({ message: 'Status atualizado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- ESTATÍSTICAS DE VENDAS -----
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
        
        const topProducts = await sql`
            SELECT 
                items::json->0->>'name' as product_name,
                COUNT(*) as total_sales,
                COALESCE(SUM(total), 0) as total_revenue
            FROM orders 
            WHERE items IS NOT NULL AND items != '' AND items != 'null' AND items != '[]'
            GROUP BY items::json->0->>'name'
            ORDER BY total_sales DESC
            LIMIT 10
        `;
        
        const salesByMethod = await sql`
            SELECT 
                COALESCE(payment_method, 'PIX') as payment_method,
                COUNT(*) as count,
                COALESCE(SUM(total), 0) as total
            FROM orders 
            GROUP BY payment_method
        `;
        
        const recentOrders = await sql`
            SELECT id, user_name, user_email, items, total, status, payment_method, created_at
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 10
        `;

        const result = {
            total: totalSales[0] || { count: 0, total: 0 },
            byDay: salesByDay || [],
            topProducts: topProducts || [],
            byMethod: salesByMethod || [],
            recent: recentOrders || []
        };
        
        console.log('📊 Estatísticas completas:', result);
        res.json(result);
    } catch (error) {
        console.error('❌ Erro nas estatísticas:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// ----- INSCRIÇÕES -----
app.post('/api/registrations', async (req, res) => {
    try {
        const { type, name, email, phone, department_name, event_name, details, amount, is_paid } = req.body;
        const result = await sql`
            INSERT INTO registrations (type, name, email, phone, department_name, event_name, details, amount, is_paid)
            VALUES (${type}, ${name}, ${email}, ${phone || ''}, ${department_name || ''}, ${event_name || ''}, ${details || ''}, ${parseFloat(amount) || 0}, ${is_paid || false})
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

// ----- DOAÇÕES -----
app.post('/api/donations', async (req, res) => {
    try {
        const { user_name, user_email, user_phone, type, amount, payment_id, payment_method } = req.body;
        const result = await sql`
            INSERT INTO donations (user_name, user_email, user_phone, type, amount, payment_id, payment_method)
            VALUES (${user_name}, ${user_email}, ${user_phone || ''}, ${type}, ${amount}, ${payment_id}, ${payment_method})
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

// ----- ESCALAS -----
app.post('/api/worship-scales', auth, async (req, res) => {
    try {
        const { department_id, event_date, leader_id, songs, palette, rehearsal } = req.body;
        
        const user = await sql`SELECT * FROM users WHERE id = ${req.user.id} AND is_leader = true`;
        if (user.length === 0 && req.user.role !== 'pastor') {
            return res.status(403).json({ error: 'Apenas líderes podem criar escalas' });
        }
        
        const result = await sql`
            INSERT INTO worship_scales (department_id, event_date, leader_id, songs, palette, rehearsal)
            VALUES (${department_id}, ${event_date}, ${leader_id}, ${songs}, ${palette}, ${rehearsal || false})
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
        const scales = await sql`
            SELECT ws.*, d.name as department_name, u.name as leader_name
            FROM worship_scales ws
            LEFT JOIN departments d ON ws.department_id = d.id
            LEFT JOIN users u ON ws.leader_id = u.id
            ORDER BY ws.event_date DESC
        `;
        res.json(scales);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/worship-scales/:id', auth, async (req, res) => {
    try {
        await sql`DELETE FROM worship_scales WHERE id = ${req.params.id}`;
        res.json({ message: 'Escala removida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----- CARROSSEL -----
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
        console.log('🖼️ Carrossel imagens:', images.length);
        res.json(images);
    } catch (error) {
        console.error('❌ Erro carrossel:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/carousel/:id', auth, pastorOnly, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subtitle, link, active } = req.body;
        
        const current = await sql`SELECT * FROM carousel_images WHERE id = ${id}`;
        if (current.length === 0) {
            return res.status(404).json({ error: 'Imagem não encontrada' });
        }
        
        let image_base64 = current[0].image_base64;
        if (req.file) {
            image_base64 = req.file.buffer.toString('base64');
        }

        const result = await sql`
            UPDATE carousel_images 
            SET title = ${title || current[0].title},
                subtitle = ${subtitle || current[0].subtitle},
                link = ${link || current[0].link},
                image_base64 = ${image_base64},
                active = ${active !== undefined ? active : current[0].active}
            WHERE id = ${id}
            RETURNING *
        `;
        res.json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao atualizar carrossel:', error);
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

// ----- CONFIGURAÇÕES -----
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
// ===== MEMBROS =====
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
        const { department_id, search } = req.query;
        
        let members;
        
        if (department_id && search) {
            members = await sql`
                SELECT * FROM members 
                WHERE is_active = true 
                AND department_id = ${department_id}
                AND (name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'} OR phone ILIKE ${'%' + search + '%'})
                ORDER BY name
            `;
        } else if (department_id) {
            members = await sql`
                SELECT * FROM members 
                WHERE is_active = true 
                AND department_id = ${department_id}
                ORDER BY name
            `;
        } else if (search) {
            members = await sql`
                SELECT * FROM members 
                WHERE is_active = true 
                AND (name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'} OR phone ILIKE ${'%' + search + '%'})
                ORDER BY name
            `;
        } else {
            members = await sql`
                SELECT * FROM members 
                WHERE is_active = true 
                ORDER BY name
            `;
        }

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

app.put('/api/members/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, email, phone, birth_date, marital_status, spouse_name,
            children, baptism_date, baptism_place, address,
            department_id, department_name, notes, is_active
        } = req.body;

        const result = await sql`
            UPDATE members SET 
                name = COALESCE(${name}, name),
                email = COALESCE(${email}, email),
                phone = COALESCE(${phone}, phone),
                birth_date = COALESCE(${birth_date}, birth_date),
                marital_status = COALESCE(${marital_status}, marital_status),
                spouse_name = COALESCE(${spouse_name}, spouse_name),
                children = COALESCE(${children}, children),
                baptism_date = COALESCE(${baptism_date}, baptism_date),
                baptism_place = COALESCE(${baptism_place}, baptism_place),
                address = COALESCE(${address}, address),
                department_id = COALESCE(${department_id}, department_id),
                department_name = COALESCE(${department_name}, department_name),
                notes = COALESCE(${notes}, notes),
                is_active = COALESCE(${is_active}, is_active)
            WHERE id = ${id}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Membro não encontrado' });
        }

        res.json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao atualizar membro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/members/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await sql`UPDATE members SET is_active = false WHERE id = ${id}`;
        res.json({ message: 'Membro removido com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover membro:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== FREQUÊNCIA =====
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

app.get('/api/attendance/:member_id', auth, async (req, res) => {
    try {
        const { member_id } = req.params;
        const { limit = 10 } = req.query;

        const result = await sql`
            SELECT * FROM attendance 
            WHERE member_id = ${member_id} 
            ORDER BY event_date DESC 
            LIMIT ${limit}
        `;

        res.json(result);
    } catch (error) {
        console.error('❌ Erro ao buscar frequência:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/attendance/stats/:member_id', auth, async (req, res) => {
    try {
        const { member_id } = req.params;

        const result = await sql`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN present = true THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN present = false THEN 1 ELSE 0 END) as absent,
                ROUND((SUM(CASE WHEN present = true THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) * 100), 2) as percentage
            FROM attendance 
            WHERE member_id = ${member_id}
        `;

        res.json(result[0]);
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== FREQUÊNCIA - CONSULTA POR DATA (NOVA ROTA) =====
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
// ===== DÍZIMOS E OFERTAS =====
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
        const { type, start_date, end_date, member_id } = req.query;
        
        let tithes;
        
        if (type && member_id) {
            tithes = await sql`
                SELECT * FROM tithes 
                WHERE type = ${type} AND member_id = ${member_id}
                ORDER BY payment_date DESC
            `;
        } else if (type) {
            tithes = await sql`
                SELECT * FROM tithes 
                WHERE type = ${type}
                ORDER BY payment_date DESC
            `;
        } else if (member_id) {
            tithes = await sql`
                SELECT * FROM tithes 
                WHERE member_id = ${member_id}
                ORDER BY payment_date DESC
            `;
        } else {
            tithes = await sql`
                SELECT * FROM tithes 
                ORDER BY payment_date DESC
            `;
        }

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
// ===== CONTAS A PAGAR =====
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
        const { paid, category } = req.query;
        
        let bills;
        
        if (paid !== undefined && category) {
            bills = await sql`
                SELECT * FROM bills 
                WHERE paid = ${paid === 'true'} AND category = ${category}
                ORDER BY due_date ASC, paid ASC
            `;
        } else if (paid !== undefined) {
            bills = await sql`
                SELECT * FROM bills 
                WHERE paid = ${paid === 'true'}
                ORDER BY due_date ASC, paid ASC
            `;
        } else if (category) {
            bills = await sql`
                SELECT * FROM bills 
                WHERE category = ${category}
                ORDER BY due_date ASC, paid ASC
            `;
        } else {
            bills = await sql`
                SELECT * FROM bills 
                ORDER BY due_date ASC, paid ASC
            `;
        }

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
        const { id } = req.params;
        await sql`DELETE FROM bills WHERE id = ${id}`;
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

        const categories = await sql`
            SELECT 
                category,
                COUNT(*) as count,
                SUM(CASE WHEN paid = false THEN amount ELSE 0 END) as pending,
                SUM(CASE WHEN paid = true THEN amount ELSE 0 END) as paid_total
            FROM bills
            GROUP BY category
            ORDER BY category
        `;

        res.json({
            summary: summary[0],
            by_category: categories
        });
    } catch (error) {
        console.error('❌ Erro ao buscar resumo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== MERCADO PAGO =====
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
                external_reference: externalReference
            }
        };

        console.log('📝 Criando pagamento PIX...');
        const payment = await PaymentService.create(paymentData);
        console.log('✅ Pagamento criado:', payment.id);

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
        console.error('❌ Erro MP:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') });
    }
});

app.post('/api/create-card-payment', async (req, res) => {
    try {
        const { amount, description, email, name, phone, cpf, card_number, card_expiry, card_cvv, installments } = req.body;

        if (!process.env.MP_ACCESS_TOKEN || !PaymentService) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }

        const valor = parseFloat(amount);
        if (isNaN(valor) || valor <= 0) {
            return res.status(400).json({ error: 'Valor inválido' });
        }

        const testToken = 'test_token';

        const paymentData = {
            body: {
                transaction_amount: valor,
                description: description || 'Pagamento NJ Cabuçu',
                payment_method_id: 'credit_card',
                installments: parseInt(installments) || 1,
                token: testToken,
                payer: {
                    email: email || 'cliente@email.com',
                    first_name: name || 'Cliente',
                    phone: { number: phone || '' },
                    identification: { type: 'CPF', number: cpf || '12345678909' }
                },
                external_reference: `NJ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
            }
        };

        console.log('📝 Criando pagamento com cartão...');
        const payment = await PaymentService.create(paymentData);
        console.log('✅ Pagamento criado:', payment.id);

        res.json({
            payment_id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            external_reference: payment.external_reference
        });
    } catch (error) {
        console.error('❌ Erro MP:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido') });
    }
});

// ============================================
// ===== WEBHOOK =====
// ============================================

app.post('/api/webhook', async (req, res) => {
    try {
        console.log('📝 Webhook recebido:', req.body);
        
        const { data, type } = req.body;
        
        if (type === 'payment' && data && data.id) {
            const paymentId = data.id;
            console.log(`✅ Pagamento ${paymentId} confirmado!`);
            
            if (PaymentService) {
                try {
                    const payment = await PaymentService.get({ id: paymentId });
                    console.log('📊 Status do pagamento:', payment.status);
                    
                    if (payment.status === 'approved') {
                        await sql`
                            UPDATE orders SET status = 'approved' WHERE payment_id = ${paymentId}
                        `;
                        await sql`
                            UPDATE donations SET status = 'approved' WHERE payment_id = ${paymentId}
                        `;
                        console.log('✅ Pagamento aprovado e registrado!');
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
// ===== PDF DE CONFIRMAÇÃO =====
// ============================================

app.get('/api/registration-pdf/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const registrations = await sql`SELECT * FROM registrations WHERE id = ${id}`;
        
        if (registrations.length === 0) {
            return res.status(404).json({ error: 'Inscrição não encontrada' });
        }
        
        const reg = registrations[0];
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Comprovante de Inscrição</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem; }
                .header { text-align: center; border-bottom: 3px solid #0D47A1; padding-bottom: 1rem; margin-bottom: 1.5rem; }
                .header h1 { color: #0D47A1; margin: 0; }
                .header p { color: #666; margin: 0; }
                .info { margin: 1rem 0; }
                .info-item { display: flex; padding: 0.5rem 0; border-bottom: 1px solid #eee; }
                .info-item .label { font-weight: bold; width: 120px; }
                .info-item .value { flex: 1; }
                .status { display: inline-block; padding: 0.3rem 1rem; border-radius: 20px; font-weight: bold; }
                .status.pending { background: #fff3cd; color: #856404; }
                .status.confirmed { background: #d4edda; color: #155724; }
                .footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; color: #888; font-size: 0.9rem; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🙏 NJ Cabuçu</h1>
                <p>Comprovante de Inscrição</p>
            </div>
            
            <div class="info">
                <div class="info-item">
                    <span class="label">Protocolo:</span>
                    <span class="value">#${String(reg.id).padStart(6, '0')}</span>
                </div>
                <div class="info-item">
                    <span class="label">Data:</span>
                    <span class="value">${new Date(reg.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                </div>
                <div class="info-item">
                    <span class="label">Tipo:</span>
                    <span class="value">${reg.type === 'baptism' ? 'Batismo' : reg.type === 'volunteer' ? 'Voluntário' : reg.type === 'event' ? 'Evento' : 'Departamento'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Nome:</span>
                    <span class="value">${reg.name}</span>
                </div>
                <div class="info-item">
                    <span class="label">E-mail:</span>
                    <span class="value">${reg.email || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Telefone:</span>
                    <span class="value">${reg.phone || '-'}</span>
                </div>
                ${reg.event_name ? `<div class="info-item"><span class="label">Evento:</span><span class="value">${reg.event_name}</span></div>` : ''}
                ${reg.department_name ? `<div class="info-item"><span class="label">Departamento:</span><span class="value">${reg.department_name}</span></div>` : ''}
                ${reg.details ? `<div class="info-item"><span class="label">Detalhes:</span><span class="value">${reg.details}</span></div>` : ''}
                <div class="info-item">
                    <span class="label">Status:</span>
                    <span class="value"><span class="status ${reg.status === 'approved' ? 'confirmed' : 'pending'}">${reg.status === 'approved' ? '✅ Confirmado' : '⏳ Pendente'}</span></span>
                </div>
                ${reg.amount > 0 ? `<div class="info-item"><span class="label">Valor:</span><span class="value">R$ ${parseFloat(reg.amount).toFixed(2)}</span></div>` : ''}
                ${reg.is_paid ? `<div class="info-item"><span class="label">Pagamento:</span><span class="value">✅ Pago</span></div>` : ''}
            </div>
            
            <div class="footer">
                <p>NJ Cabuçu - "E conhecereis a verdade, e a verdade vos libertará." João 8:32</p>
                <p>© ${new Date().getFullYear()} NJ Cabuçu - Todos os direitos reservados</p>
            </div>
        </body>
        </html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);
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
    console.log('');
    console.log('📸 Imagens salvas como Base64 no banco de dados!');
    console.log('');
});
