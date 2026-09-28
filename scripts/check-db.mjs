import { createClient } from '@supabase/supabase-js';

const url = 'https://rbffqdtuqxugocmodyex.supabase.co';
const key = 'sb_publishable_C8obUPS-kUo1mvD9Rswqqg_imZu3tYE';
const supabase = createClient(url, key);

async function run() {
  // 1. Check if admin_audit_logs table exists
  const { error: auditErr } = await supabase.from('admin_audit_logs').select('id').limit(0);
  console.log('admin_audit_logs exists:', auditErr ? 'NO => ' + auditErr.message : 'YES');

  // 2. Try to query profiles with government role filter
  const { data: govProfiles, error: govErr } = await supabase
    .from('profiles')
    .select('auth_user_id, role, jurisdiction_level, state, district, department')
    .eq('role', 'government')
    .limit(5);
  console.log('government profiles:', JSON.stringify(govProfiles), govErr ? 'error: ' + govErr.message : '');

  // 3. Test inserting a government profile (to check constraint)
  const testId = '00000000-0000-0000-0000-000000000099';
  const { error: insertErr } = await supabase.from('profiles').upsert({
    auth_user_id: testId,
    full_name: 'Constraint Test',
    email: 'constrainttest@test.gov',
    role: 'government'
  }, { onConflict: 'auth_user_id' });
  console.log('Insert government role test:', insertErr ? 'CONSTRAINT BLOCKED => ' + insertErr.message : 'SUCCESS - government role is allowed');

  // Cleanup
  if (!insertErr) {
    await supabase.from('profiles').delete().eq('auth_user_id', testId);
    console.log('Cleanup done');
  }

  // 4. Check events table columns
  const { error: eventsErr } = await supabase.from('events').select('state, district, reviewed_by').limit(0);
  console.log('events has state/district/reviewed_by columns:', eventsErr ? 'NO => ' + eventsErr.message : 'YES');

  // 5. Check auth users list (anon key won't show all users, but let's see)
  const { data: session } = await supabase.auth.getSession();
  console.log('Current session:', session.session ? 'ACTIVE user: ' + session.session.user.email : 'NONE');
}

run().catch(console.error);
