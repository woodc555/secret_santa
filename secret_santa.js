jQuery(document).ready(function($) {
   let currentUser = null;
   let givingGift = null;
   let assignment = { matched: false, receiver: null };

   function parseWishlist(wishlist) {
      if (!wishlist) {
         return [];
      }
      if (Array.isArray(wishlist)) {
         return wishlist;
      }
      if (typeof wishlist === 'string') {
         try {
            return JSON.parse(wishlist);
         } catch (error) {
            return [];
         }
      }
      return [];
   }

   function clearSession() {
      API.logout();
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isLoggedIn');
      currentUser = null;
      givingGift = null;
      assignment = { matched: false, receiver: null };
   }

   async function restoreSession() {
      if (!API.token) {
         return false;
      }

      try {
         const data = await API.me();
         currentUser = data.user;
         localStorage.setItem('currentUser', JSON.stringify(currentUser));
         localStorage.setItem('isLoggedIn', true);
         return true;
      } catch (error) {
         clearSession();
         return false;
      }
   }

   async function loggedInUser() {
      $('header').show();
      $('#logout-button').show();
      $('.logged-in').show();
      $('.login-prompt').hide();
      $('#error-banner').hide();

      $('#welcome-message').text(`Hello ${currentUser.name}!`);
      loadWishlist();

      if (currentUser.is_admin === true) {
         $('.admin-link').show();
      } else {
         $('.admin-link').hide();
      };

      try {
         assignment = await API.assignment();
      } catch (error) {
         console.log('Assignment error:', error);
         assignment = { matched: false, receiver: null };
      }

      if (assignment.matched && assignment.receiver) {
         currentUser.matched = true;
         localStorage.setItem('currentUser', JSON.stringify(currentUser));
         $('#logged-in-prompt').text(`You are Secret Santa to ${assignment.receiver.name}!`);
         $('#match-button').hide();
         loadReceiverWishlist(assignment.receiver);
      } else {
         $('#logged-in-prompt').text('Press the Button Below ');
         $('#match-button').show();
         $('#receiver-wishlist-container').hide();
      };
   };

   function loadWishlist() {
      const wishlistContainer = $('#wishlist-items');
      wishlistContainer.empty();

      const wishList = parseWishlist(currentUser.wishlist);

      wishList.forEach((item, index) => {
         const itemHtml = `
            <li class="wishlist-item" data-index="${index}">
               <div class="item-display">
                  <div class="item-name item-details">${item.name || 'Unnamed Item'}</div>
                  <div class="item-link item-details">
                     <a href="${item.link}" target="_blank">${item.link || 'No Link'}</a>
                  </div>
               </div>
               <div class="item-actions">
                  <button class="edit-item item-action-button" data-index="${index}">Edit</button>
                  <button class="delete-item item-action-button" data-index="${index}">Delete</button>
               </div>
            </li>
         `;

         wishlistContainer.append(itemHtml);
      });
   };

   function loadReceiverWishlist(receiver) {
      const container = $('#receiver-wishlist-container');
      const itemsList = $('#receiver-wishlist-items');
      const title = $('#receiver-wishlist-title');

      if (!receiver) {
         console.error('Receiver not found');
         container.hide();
         return;
      }

      container.show();
      title.text(`${receiver.name}'s Wishlist`);
      itemsList.empty();

      const wishList = parseWishlist(receiver.wishlist);

      if (wishList.length === 0) {
         itemsList.append('<li>No items on the wishlist yet.</li>');
      } else {
         wishList.forEach((item) => {
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
      if (!currentUser || !currentUser.id) {
         console.error('currentUser.id is missing');
         alert('Error: User ID not found. Please log in again.');
         return false;
      }

      try {
         const data = await API.saveWishlist(wishListArray);
         currentUser = data.user;
         localStorage.setItem('currentUser', JSON.stringify(currentUser));
         return true;
      } catch (error) {
         console.error('Error saving wishlist:', error);
         alert('Failed to save wishlist: ' + error.message);
         return false;
      }
   };

   async function addWishlistItem(name, link) {
      const wishList = parseWishlist(currentUser.wishlist);
      wishList.push({name: name, link: link});

      const success = await saveWishlist(wishList);
      if (success) {
         loadWishlist();
      }
   };
   
   async function removeWishlistItem(index) {
      const wishList = parseWishlist(currentUser.wishlist);
      wishList.splice(index, 1);

      const success = await saveWishlist(wishList);
      if (success) {
         loadWishlist();
      };
   };

   async function editWishlistItem(index, newName, newLink) {
      const wishList = parseWishlist(currentUser.wishlist);
      wishList[index] = {name: newName, link: newLink};

      const success = await saveWishlist(wishList);
      if (success) {
         loadWishlist();
      };
   };

   function showEditForm(index) {
      const wishList = parseWishlist(currentUser.wishlist);
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

      listItem.find('.item-display, .item-actions').hide();
      listItem.append(editForm);
   }

   $('#pin-submit').click(async function() {
      const pin = $('#pin-input').val();
      $('#error-banner').hide();

      if (pin === ''){
         $('#error-banner').text('Please Enter a Pin').show();
         return;
      }
      if (pin.length !== 4) {
         $('#error-banner').text('Pin is too long or short').show();
         return;
      }

      try {
         currentUser = await API.login(pin);
         localStorage.setItem('currentUser', JSON.stringify(currentUser));
         localStorage.setItem('isLoggedIn', true);
         $('#pin-input').val('');
         await loggedInUser();
      } catch (error) {
         $('#error-banner').text(error.message || 'Invalid or Non-Existant Pin').show();
      }
   });

   $('#match-button').click(async function() {
      $('#match-button').prop('disabled', true);
      $('#match-button').text('Matching...');
      $('#error-banner').hide();

      try {
         assignment = await API.match();
         currentUser.matched = true;
         localStorage.setItem('currentUser', JSON.stringify(currentUser));
         $('#logged-in-prompt').text(`You are Secret Santa to ${assignment.receiver.name}!`);
         $('#match-button').hide();
         loadReceiverWishlist(assignment.receiver);
      } catch (error) {
         $('#error-banner').text(error.message || 'Error saving pairing. Try Again Please.').show();
         $('#match-button').prop('disabled', false);
         $('#match-button').text('Match');
      }
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
      clearSession();

      $('#pin-input').val('');
      $('.logged-in').hide();
      $('.login-prompt').show();
      $('.admin-link').hide();
      $('#match-button').prop('disabled', false).text('Match');
   });

   restoreSession().then((ok) => {
      if (ok) {
         loggedInUser();
      }
   });
});
