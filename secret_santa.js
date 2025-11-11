const SUPABASE_URL = 'https://pluqpfomthvfelqbbgvm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsdXFwZm9tdGh2ZmVscWJiZ3ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MjAxODQsImV4cCI6MjA3ODM5NjE4NH0.n7IpwPJJuDVErH7TdgLg25QJjkpINgA5lqXUlk1JaqY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getParticipants() {
 const { data, error } = await supabase.from('participants').select('*');

 if (error) {
    console.log('Error:', error);
 } else {
    console.log('Participants:', data);
 };
};

getParticipants();

console.log('Supabase connected!', supabase);