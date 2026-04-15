const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async function handler(req, res) {
  // Allow CORS for Tauri app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token manquant' });
  }

  // Find license
  const { data: license, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !license) {
    return res.status(200).json({ valid: false, error: 'Licence introuvable' });
  }

  if (license.activated) {
    return res.status(200).json({ valid: false, error: 'Licence déjà activée' });
  }

  // Mark as activated
  const { error: updateError } = await supabase
    .from('licenses')
    .update({ activated: true, activated_at: new Date().toISOString() })
    .eq('token', token);

  if (updateError) {
    return res.status(500).json({ valid: false, error: 'Erreur serveur' });
  }

  return res.status(200).json({ valid: true, email: license.email });
};
