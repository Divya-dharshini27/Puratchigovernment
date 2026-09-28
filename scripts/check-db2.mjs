import { createClient } from '@supabase/supabase-js';

const url = 'https://rbffqdtuqxugocmodyex.supabase.co';
const key = 'sb_publishable_C8obUPS-kUo1mvD9Rswqqg_imZu3tYE';
const supabase = createClient(url, key);

async function run() {
  // Sign up a real test government user to check if the DB accepts it
  const testEmail = 'govtest_' + Date.now() + '@test.gov.in';
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: testEmail,
    password: 'Test@123456',
    options: {
      data: { full_name: 'DB Test Gov', role: 'government' }
    }
  });
  
  console.log('SignUp error:', authErr?.message ?? 'NONE');
  console.log('SignUp user id:', authData?.user?.id ?? 'NONE');
  
  if (authData?.user?.id) {
    // Try upsert as the signed-in user (they have a valid session now even without email confirm in dev)
    const { error: profileErr } = await supabase.from('profiles').upsert({
      auth_user_id: authData.user.id,
      full_name: 'DB Test Gov',
      email: testEmail,
      role: 'government',
      jurisdiction_level: 'district',
      state: 'Tamil Nadu',
      district: 'Chennai'
    }, { onConflict: 'auth_user_id' });
    
    console.log('Profile insert (as auth user):', profileErr ? 'FAILED => ' + profileErr.message : 'SUCCESS');
    
    // Clean up - sign out
    await supabase.auth.signOut();
  }
}

run().catch(console.error);
