const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendMail({ to, subject, html, text, replyTo }) {
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    html,
    text,
    replyTo,
  });
}

async function sendWelcome(user) {
  return sendMail({
    to: user.email,
    subject: 'Bem-vindo(a) ao LêBrasil!',
    text: `Olá, ${user.name}! Sua conta no LêBrasil foi criada. Boas leituras!`,
    html: `<p>Olá, <strong>${escapeHtml(user.name)}</strong>!</p>
           <p>Sua conta no <strong>LêBrasil</strong> foi criada com sucesso. Agora você pode ler as obras da literatura brasileira e acompanhar seu progresso.</p>
           <p>Boas leituras!</p>`,
  });
}

async function sendPasswordReset(user, link) {
  return sendMail({
    to: user.email,
    subject: 'Redefinição de senha - LêBrasil',
    text: `Olá, ${user.name}! Para redefinir sua senha, acesse: ${link} (o link vale por 1 hora).`,
    html: `<p>Olá, <strong>${escapeHtml(user.name)}</strong>!</p>
           <p>Recebemos um pedido para redefinir sua senha. Clique no link abaixo (válido por 1 hora):</p>
           <p><a href="${link}">${link}</a></p>
           <p>Se você não fez esse pedido, ignore este e-mail.</p>`,
  });
}

async function sendContactToAdmin({ name, email, subject, message }) {
  return sendMail({
    to: process.env.CONTACT_TO,
    replyTo: email,
    subject: `[Contato LêBrasil] ${subject || 'Nova mensagem'}`,
    text: `De: ${name} <${email}>\n\n${message}`,
    html: `<p><strong>De:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
           <p><strong>Assunto:</strong> ${escapeHtml(subject || '-')}</p>
           <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
  });
}

module.exports = { sendWelcome, sendPasswordReset, sendContactToAdmin };
