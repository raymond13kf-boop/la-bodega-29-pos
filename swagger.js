import { createClient } from '@supabase/supabase-js';

async function fetchSchema() {
  const url = 'https://qklchvamohdnofgtadpk.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrbGNodmFtb2hkbm9mZ3RhZHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjk4MDgsImV4cCI6MjA5Mzg0NTgwOH0.07eon7welOuSg03OPmktn106FUXal5_R1uTKl5PQtF4';
  const res = await fetch(url);
  const data = await res.json();
  console.log(Object.keys(data.definitions));
  if (data.definitions.sales) {
    console.log(data.definitions.sales.properties);
  }
}

fetchSchema();
