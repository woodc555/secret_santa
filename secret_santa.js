const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

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