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

jQuery(document).ready(function($) {
   let currentUser = null;
   let givingGift = null;

   const savedUser = localStorage.getItem('currentUser');
   const isLoggedIn = localStorage.getItem('isLoggedIn');

   if (savedUser && isLoggedIn) {
      currentUser = JSON.parse(savedUser);

      loggedInUser();
   }

   function loggedInUser() {
      $('.logged-in').show();
      $('.login-prompt').hide();

      $('#welcome-message').text(`Hello ${currentUser.name}!`);

      if (currentUser.matched == true) {
         $('#logged-in-prompt').text('You are Secret Santa to insert name here!');
      } else {
         $('#logged-in-prompt').text('Press the Button Below ');
         $('#match-button').show();
      }      
   }

   $('#pin-submit').click(async function() {
      const pin = $('#pin-input').val();

      const {data, error} = await supabase.from('participants').select('*').eq('pin', pin).single();

      if (pin === ''){
         $('#error-banner').text('Please Enter a Pin').show();
      } else if(pin.length < 4 || pin.length > 4) {
         $('#error-banner').text('Pin is too long or short').show();
      } else if (error){
         $('#error-banner').text('Invalid or Non-Existant Pin').show();
      } else {
         $('#pin-input').val('');

         currentUser = data;
         localStorage.setItem('currentUser', JSON.stringify(currentUser));
         localStorage.setItem('isLoggedIn', true);

         loggedInUser();
      }

   });

   $('#logout-button').click(function() {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isLoggedIn');

      currentUser = null;
      givingGift = null;

      $('#pin-input').val('');
      $('.logged-in').hide();
      $('.login-prompt').show();
   });
});