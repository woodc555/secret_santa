const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase connected!', supabase);

jQuery(document).ready(function($) {
   let currentUser = null;
   let givingGift = null;

   let allParticipants = null;
   let allPairings = null;

   async function getParticipants() {
      const { data, error } = await supabase.from('participants').select('*');
     
      if (error) {
         console.log('Error:', error);
         allParticipants = [];
      } else {
         allParticipants = data;
      };
     };
     getParticipants();

   async function getPairings() {
      const {data: pairings, error: fetchError} = await supabase.from('pairings').select('giver_id, receiver_id');
      if (fetchError) {
         console.log('Fetch Pairings Error:', fetchError);
         allPairings = [];
      } else {
         allPairings = pairings;
      };
   };
   getPairings();

   const savedUser = localStorage.getItem('currentUser');
   const isLoggedIn = localStorage.getItem('isLoggedIn');

   if (savedUser && isLoggedIn) {
      currentUser = JSON.parse(savedUser);

      loggedInUser();
   };

   async function loggedInUser() {
      $('header').show();
      $('#logout-button').show();
      $('.logged-in').show();
      $('.login-prompt').hide();

      $('#welcome-message').text(`Hello ${currentUser.name}!`);
      loadWishlist();

      if (currentUser.is_admin === true) {
         $('.admin-link').show();
      } else {
         $('.admin-link').hide();
      };

      if (currentUser.matched == true) {
         if (!allPairings || allPairings.length === 0) {
            await getPairings();
         };
         if (!allParticipants || allParticipants.length === 0) {
            await getParticipants();
         };
         
         const userPairing = allPairings.find(pairing => pairing.giver_id === currentUser.id);
         
         const receiverId = userPairing.receiver_id;
         const receiver = allParticipants.find(participant => participant.id === receiverId);
         
         $('#logged-in-prompt').text(`You are Secret Santa to ${receiver.name}!`);

         loadReceiverWishlist(receiverId);
         
      } else {
         $('#logged-in-prompt').text('Press the Button Below ');
         $('#match-button').show();
         $('#receiver-wishlist-container').hide();
      };      
   };

   function loadWishlist() {
      const wishlistContainer = $('#wishlist-items');
      wishlistContainer.empty();

      let wishList = [];
      if (currentUser.wishlist) {
         wishList = typeof currentUser.wishlist === 'string' ? JSON.parse(currentUser.wishlist) : currentUser.wishlist;
      };

      wishList.forEach((item, index) => {
         const itemHtml = `
            <li class="wishlist-item" data-index="${index}">
               <div class="item-display">
                  <div class="item-name">${item.name || 'Unnamed Item'}</div>
                  <div class="item-link">
                     <a href="${item.link}" target="_blank">${item.link || 'No Link'}</a>
                  </div>
               </div>
               <div class="item-actions">
                  <button class="edit-item" data-index="${index}">Edit</button>
                  <button class="delete-item" data-index="${index}">Delete</button>
               </div>
            </li>
         `;

         wishlistContainer.append(itemHtml);
      });
   };

   function loadReceiverWishlist(receiverId) {
      const container = $('#receiver-wishlist-container');
      const itemsList = $('#receiver-wishlist-items');
      const title = $('#receiver-wishlist-title');

      const receiver = allParticipants.find(participant => participant.id === receiverId);
      
      if (!receiver) {
         console.error('Receiver not found');
         container.hide();
         return;
      }

      container.show();

      title.text(`${receiver.name}'s Wishlist`);

      itemsList.empty();

      let wishList = [];
      if (receiver.wishlist) {
         wishList = typeof receiver.wishlist === 'string' ? JSON.parse(receiver.wishlist) : receiver.wishlist;
      };

      if (wishList.length === 0) {
         itemsList.append('<li>No items on the wishlist yet.</li>');
      } else {
         wishList.forEach((item, index) => {
            const itemHtml = `
               <li class="receiver-wishlist-item">
                  <div class="item-name">${item.name || 'Unnamed Item'}</div>
                  <div class="item-link">
                     <a href="${item.link}" target="_blank">${item.link || 'No Link'}</a>
                  </div>
               </li>
            `;
            itemsList.append(itemHtml);
         });
      };
   };

   async function saveWishlist(wishListArray) {
      const wishlistJson = JSON.stringify(wishListArray);

      if (!currentUser || !currentUser.id) {
         console.error('currentUser.id is missing');
         alert('Error: User ID not found. Please log in again.');
         return false;
      }

      console.log('Saving wishlist for user ID:', currentUser.id);

      const {data, error} = await supabase.from('participants').update({wishlist: wishlistJson}).eq('id', currentUser.id).select().single();
      if (error) {
         console.error('Error saving wishlist:', error);
         alert('Failed to save wishlist: ' + error.message);
         return false;
      }

      console.log('Wishlist saved successfully:', data);

      currentUser.wishlist = wishlistJson;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      return true;
   };

   async function addWishlistItem(name, link) {
      let wishList = [];
      if (currentUser.wishlist) {
         wishList = typeof currentUser.wishlist === 'string' ? JSON.parse(currentUser.wishlist) : currentUser.wishlist;
      };

      wishList.push({name: name, link: link});

      const success = await saveWishlist(wishList);
      if (success) {
         loadWishlist();
      }
   };
   
   async function removeWishlistItem(index) {
      let wishList = [];
      if (currentUser.wishlist) {
         wishList = typeof currentUser.wishlist === 'string' ? JSON.parse(currentUser.wishlist) : currentUser.wishlist;
      };

      wishList.splice(index, 1);

      const success = await saveWishlist(wishList);
      if (success) {
         loadWishlist();
      };
   };

   async function editWishlistItem(index, newName, newLink) {
      let wishList = [];
      if (currentUser.wishlist) {
         wishList = typeof currentUser.wishlist === 'string' ? JSON.parse(currentUser.wishlist) : currentUser.wishlist;
      };

      wishList[index] = {name: newName, link: newLink};

      const success = await saveWishlist(wishList);
      if (success) {
         loadWishlist();
      };
   };

   function showEditForm(index) {
      let wishList = [];
      if (currentUser.wishlist) {
         wishList = typeof currentUser.wishlist === 'string' ? JSON.parse(currentUser.wishlist) : currentUser.wishlist;
      };

      const item = wishList[index];
      const listItem = $(`.wishlist-item[data-index="${index}"]`);

      const editForm = `
         <div class="item-edit">
            <input type="text" id="edit-item-name" value="${item.name || ''}" data-index="${index}">
            <input type="url" id="edit-item-link" value="${item.link || ''}" data-index="${index}">
            <button class="save-edit-btn" data-index="${index}">Save</button>
            <button class="cancel-edit-btn" data-index="${index}">Cancel</button>
         </div>
      `;

      // Replace the item display with edit form
      listItem.find('.item-display, .item-actions').hide();
      listItem.append(editForm);
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

         await loggedInUser();
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

   $('#add-item').click(function() {
      $('#add-item-form').show();
      $('#add-item').hide();
   });

   $('#save-new-item').click(async function() {
      const name = $('#new-item-name').val();
      const link = $('#new-item-link').val();

      if (!name.trim()) {
         alert('Please enter a name for the item.');
         return;
      };

      await addWishlistItem(name, link);
      $('#new-item-name').val('');
      $('#new-item-link').val('');
      $('#add-item-form').hide();
      $('#add-item').show();
   });

   $('#cancel-add-item').click(function() {
      $('#new-item-name').val('');
      $('#new-item-link').val('');
      $('#add-item-form').hide();
      $('#add-item').show();
   });

   $(document).on('click', '.edit-item', function() {
      const index = parseInt($(this).data('index'));
      showEditForm(index);
   });

   $(document).on('click', '.delete-item', async function() {
      const index = parseInt($(this).data('index'));
      if (confirm('Are you sure you want to delete this item?')) {
         await removeWishlistItem(index);
      }
   });

   $(document).on('click', '.save-edit-btn', async function() {
      const index = parseInt($(this).data('index'));
      const listItem = $(`.wishlist-item[data-index="${index}"]`);
      const name = listItem.find('#edit-item-name').val();
      const link = listItem.find('#edit-item-link').val();
      await editWishlistItem(index, name, link);
   });

   $(document).on('click', '.cancel-edit-btn', function() {
      loadWishlist();
   });

   $('#logout-button').click(function() {
      $('header').hide();
      $('#logout-button').hide();
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isLoggedIn');

      currentUser = null;
      givingGift = null;

      $('#pin-input').val('');
      $('.logged-in').hide();
      $('.login-prompt').show();
      $('.admin-link').hide();
   });
});