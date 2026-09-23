/**
 * Email Service for WriteMyWords
 * Handles sending welcome & account confirmation emails with login credentials.
 */

export async function sendAccountCreatedEmail({ name, email, password, role }) {
  const roleLabel = role === 'expert' ? 'Helper / Expert' : 'Student (Work Requester)';
  const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://writemywords.vercel.app/login';
  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const emailPayload = {
    to_email: email,
    to_name: name || 'User',
    subject: '🎉 Welcome to WriteMyWords - Account Created Successfully!',
    login_id: email,
    password: password,
    role: roleLabel,
    login_url: loginUrl,
    date: currentDate,
    message: `Hello ${name || 'there'},\n\nYour WriteMyWords account has been created successfully!\n\nHere are your login credentials:\n- Login ID (Email): ${email}\n- Password: ${password}\n- Account Type: ${roleLabel}\n- Date: ${currentDate}\n\nYou can log in anytime at: ${loginUrl}\n\nThank you for choosing WriteMyWords!`,
  };

  try {
    // Attempt webhook or external email dispatcher if configured
    if (import.meta.env.VITE_EMAIL_WEBHOOK_URL) {
      await fetch(import.meta.env.VITE_EMAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      });
    }
  } catch (err) {
    console.warn('Email dispatch notice:', err);
  }

  return emailPayload;
}
