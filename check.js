import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qklchvamohdnofgtadpk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrbGNodmFtb2hkbm9mZ3RhZHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjk4MDgsImV4cCI6MjA5Mzg0NTgwOH0.07eon7welOuSg03OPmktn106FUXal5_R1uTKl5PQtF4'
);

async function testUpdate() {
  const { data, error } = await supabase.from('sales').update({ status: 'anulada' }).eq('id', 'some-id');
  console.log("Update error:", error);
}

testUpdate();
