require('dotenv').config();

console.log('=== TESTE DE VARIÁVEIS DE AMBIENTE ===');
console.log('');
console.log('📊 DATABASE_URL:', process.env.DATABASE_URL ? '✅ Carregada' : '❌ Não carregada');
console.log('🔑 MP_ACCESS_TOKEN:', process.env.MP_ACCESS_TOKEN ? '✅ Carregado' : '❌ Não carregado');
console.log('🔑 MP_PUBLIC_KEY:', process.env.MP_PUBLIC_KEY ? '✅ Carregado' : '❌ Não carregado');
console.log('🔐 JWT_SECRET:', process.env.JWT_SECRET ? '✅ Carregado' : '❌ Não carregado');
console.log('🚪 PORT:', process.env.PORT || '3000 (padrão)');
console.log('');

if (process.env.DATABASE_URL) {
    console.log('✅ Banco de dados configurado');
    console.log('📝 URL:', process.env.DATABASE_URL.substring(0, 60) + '...');
} else {
    console.log('❌ ERRO: DATABASE_URL não encontrada');
    console.log('📝 Verifique se o arquivo .env existe e tem a DATABASE_URL');
}

if (process.env.MP_ACCESS_TOKEN) {
    console.log('✅ Mercado Pago configurado');
} else {
    console.log('⚠️ Mercado Pago não configurado');
}

console.log('');
console.log('✅ Teste concluído!');