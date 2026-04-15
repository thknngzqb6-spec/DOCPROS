const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const crypto = require('crypto');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// Disable body parsing to get raw body for Stripe signature verification
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;

    if (!email) {
      console.error('No email in session');
      return res.status(200).json({ received: true });
    }

    // Generate unique activation token
    const token = crypto.randomUUID();

    // Store in Supabase
    const { error: dbError } = await supabase
      .from('licenses')
      .insert({
        token,
        email,
        stripe_payment_id: session.payment_intent || session.id,
      });

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Send activation email
    const activationUrl = `https://getdocpro.fr/activate.html?token=${token}`;

    const { error: emailError } = await resend.emails.send({
      from: 'DocPro <noreply@getdocpro.fr>',
      to: email,
      subject: 'Activez votre licence DocPro',
      html: `
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
          <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #4f46e5; color: white; border-radius: 10px; font-weight: 800; font-size: 24px; margin-bottom: 16px;">D</div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #111827;">Merci pour votre achat !</h1>
            </div>
            <p style="color: #4b5563; line-height: 1.7; margin-bottom: 8px;">
              Votre licence DocPro est prête. Cliquez sur le bouton ci-dessous pour activer le logiciel.
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 32px;">
              Assurez-vous d'avoir installé DocPro avant de cliquer.
            </p>
            <div style="text-align: center; margin-bottom: 32px;">
              <a href="${activationUrl}" style="display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Activer DocPro →
              </a>
            </div>
            <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #374151;">Pas encore installé ?</p>
              <p style="margin: 0; font-size: 13px; color: #6b7280;">
                Téléchargez DocPro sur <a href="https://getdocpro.fr/#download" style="color: #4f46e5;">getdocpro.fr</a>, installez-le, puis cliquez sur le bouton ci-dessus.
              </p>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              Ce lien est à usage unique. Conservez cet email.<br>
              Des questions ? <a href="mailto:contact@getdocpro.fr" style="color: #4f46e5;">contact@getdocpro.fr</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
    }
  }

  return res.status(200).json({ received: true });
};
