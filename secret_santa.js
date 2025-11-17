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

   $('#match-button').click(async function() {
      $('#match-button').prop('disabled', true);
      $('#match-button').text('Matching...');

      const {data: allParticipants, error: fetchError} = await supabase.from('participants').select('*');
      if (fetchError) {
         console.log('Fetch All Error:', fetchError);

         $('#match-button').prop('disabled', false);
         $('#match-button').text('Match');
         return;
      }

      const {data:existingPairings, error: pairingError} = await supabase.from('pairings').select('receiver_id');
      if (pairingError) {
         console.log('Pairing Error:', pairingError);

         $('#error-banner').text('Error fetching existing pairings. Try Again Please.').show();
         $('#match-button').prop('disabled', false);
         $('#match-button').text('Match');
         return;
      }
      const takenReceiverIds = existingPairings.map(pairing => pairing.receiver_id);

      const eligibleParticipants = allParticipants.filter(participant => {
         return participant.id !== currentUser.id 
         && participant.family_group !== currentUser.family_group 
         && !participant.matched
         && !takenReceiverIds.includes(participant.id);
      });

      if (eligibleParticipants.length === 0) {
         $('#error-banner').text('No eligible participants found. Please try again later.').show();

         $('#match-button').prop('disabled', false);
         $('#match-button').text('Match');
         return;
      }

      const randomIndex = Math.floor(Math.random() * eligibleParticipants.length);
      const matchedParticipant = eligibleParticipants[randomIndex];

      const {data: newPairing, error: insertError} = await supabase.from('pairings').insert({giver_id: currentUser.id, receiver_id: matchedParticipant.id}).select().single();
      if (insertError) {
         console.log('Insert Error:', insertError);

         $('#error-banner').text('Error saving pairing. Try Again Please.').show();
         $('#match-button').prop('disabled', false);
         $('#match-button').text('Match');
         return;
      }

      const {error: updateError} = await supabase.from('participants').update({matched:true}).eq('id', currentUser.id);
      if (updateError) {
         console.log('Update Error:', updateError);

         $('#error-banner').text('Error updating participant. Try Again Please.').show();
         $('#match-button').prop('disabled', false);
         $('#match-button').text('Match');
         return;
      }

      currentUser.matched = true;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      $('#logged-in-prompt').text(`You are Secret Santa to ${matchedParticipant.name}!`);
      $('#match-button').hide();
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