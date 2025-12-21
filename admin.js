const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase connected!', supabaseClient);

jQuery(document).ready(function($) {
    let currentUser = null;

    let allParticipants = null;
    let allPairings = null;

    const savedUser = localStorage.getItem('currentUser');
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    async function loggedInAdmin() {
        $('.login-prompt').hide();
        $('.logged-in').show();
        $('#welcome-message').text(`Hello ${currentUser.name}!`);

        await fetchPairings();

        buildParticipantsTable();
    };

    async function fetchPairings() {
        const {data: participants, error: participantsError} = await supabaseClient.from('participants').select('*');
        if (participantsError) {
            console.log('Error Fetching Participants:', participantsError);
            allParticipants = [];
        } else {
            allParticipants = participants;
        };

        const {data: pairings, error: pairingsError} = await supabaseClient.from('pairings').select('*');
        if (pairingsError) {
            console.log('Error Fetching Pairings:', pairingsError);
            allPairings = [];
        } else {
            allPairings = pairings;
        };
    };

    function buildParticipantsTable() {
        const tableBody = $('#participants-table-body');
        tableBody.empty();

        if (!allParticipants || allParticipants.length === 0) {
            tableBody.append('<tr><td colspan="5">No participants found</td></tr>');
            return;
        };

        const sortedParticipants = [...allParticipants].sort((a, b) => a.id - b.id);

        sortedParticipants.forEach(participant => {
           const pairing = allPairings.find(p => p.giver_id === participant.id);

           let receiverName = 'Not Matched';
           if (pairing) {
            const receiver = allParticipants.find(p => p.id === pairing.receiver_id);
            if (receiver) {
                receiverName = receiver.name;
            };
           };

           const row = `
            <tr>
                <td>${participant.name}</td>
                <td>${receiverName}</td>
                <td>${participant.matched ? 'Yes' : 'No'}</td>
                <td>${participant.family_group}</td>
                <td>${participant.is_admin ? 'Yes' : 'No'}</td>
                <td><button class="edit-button" data-id="${participant.id}">Edit</button></td>
            </tr>
           `;

           tableBody.append(row);
        });
    };

    function openEditModal(participantId) {
        const participant = allParticipants.find(p => p.id === participantId);

        if (!participant) {
            console.log('Participant not found');
            return;
        };

        $('#edit-participant-id').val(participant.id);
        $('#edit-name').val(participant.name);
        $('#edit-giving-to').val(participant.giving_to);
        $('#edit-matched').prop('checked', participant.matched);
        $('#edit-family-group').val(participant.family_group);
        $('#edit-admin').prop('checked', participant.is_admin);

        const givingToSelect = $('#edit-giving-to');
        givingToSelect.empty();
        givingToSelect.append(`<option value="">Not Matched</option>`);

        allParticipants.forEach(p => {
            if (p.id !== participantId) {
                const option = $('<option></option>').val(p.id).text(p.name);
                givingToSelect.append(option);
            };
        });

        const currentGivingTo = allPairings.find(pair => pair.giver_id === participantId);
        if (currentGivingTo) {
            givingToSelect.val(currentGivingTo.receiver_id);
        } else{
            givingToSelect.val('');
        };

        const selectedValue = givingToSelect.val();
        $('#edit-matched').prop('checked', selectedValue !== '' && selectedValue !== null);

        $('#edit-modal').show();
    };

    async function saveParticipantEdit() {
        const participantId = $('#edit-participant-id').val();
        const name = $('#edit-name').val();
        const matched = $('#edit-matched').prop('checked');
        const familyGroup = $('#edit-family-group').val();
        const isAdmin = $('#edit-admin').prop('checked');
        const givingToId = $('#edit-giving-to').val();

        console.log('Saving participant:', { participantId, name, matched, familyGroup, isAdmin, givingToId });

        if (!participantId) {
            alert('Error: Participant ID is missing. Please try again.');
            return;
        }

        const updateData = {
            name: name,
            matched: matched,
            family_group: familyGroup,
            is_admin: isAdmin,
        };

        const {data, error} = await supabaseClient.from('participants').update(updateData).eq('id', participantId).select().single();
        if (error) {
            console.log('Error Updating Participant:', error);
            alert('Failed to update participant: ' + error.message);
            return;
        }

        console.log('Participant updated successfully:', data);

        const index = allParticipants.findIndex(p => p.id === participantId);
        if (index !== -1) {
            allParticipants[index] = data;
        };

        const existingPairing = allPairings.find(p => p.giver_id === participantId);
        if (givingToId && givingToId !== '') {
        if (existingPairing) {
            const {error: pairingError} = await supabaseClient.from('pairings').update({receiver_id: givingToId}).eq('id', existingPairing.id);
            if (pairingError) {
                console.log('Error Updating Pairing:', pairingError);
                alert('Failed to update pairing. Please try again.');
            } else {
                const pairingIndex = allPairings.findIndex(p => p.id === existingPairing.id);
                if (pairingIndex !== -1) {
                    allPairings[pairingIndex].receiver_id = givingToId;
                };
            };
        } else {
            const {data: newPairing, error: pairingError} = await supabaseClient.from('pairings').insert({giver_id: participantId, receiver_id: givingToId}).select().single();
            if (pairingError) {
                console.log('Error Creating Pairing:', pairingError);
                alert('Failed to create pairing. Please try again.');
            } else{
                allPairings.push(newPairing);
            };
        };
        } else {
            const {error: pairingError} = await supabaseClient
                .from('pairings')
                .delete()
                .eq('giver_id', participantId);
            
            if (pairingError) {
                console.log('Error Deleting Pairing:', pairingError);
                alert('Failed to delete pairing. Please try again.');
            } else {
                allPairings = allPairings.filter(p => p.giver_id !== participantId);
            }
        }

        const hasPairing = givingToId && givingToId !== '';

        if (matched !== hasPairing) {
            const {error: updateError} = await supabaseClient.from('participants').update({matched: matched}).eq('id', participantId);
            if (!updateError) {
                const participantIndex = allParticipants.findIndex(p => p.id === participantId);
                if (participantIndex !== -1) {
                    allParticipants[participantIndex].matched = matched;
                };
            };
        };

        await fetchPairings();
        
        buildParticipantsTable();
        closeEditModal();
    };

    function closeEditModal() {
        $('#edit-modal').hide();
        $('#edit-form')[0].reset();
    };

    if (savedUser && isLoggedIn) {
        currentUser = JSON.parse(savedUser);

        if (currentUser.is_admin === true) {
            loggedInAdmin();
        } else {
            window.location.href = 'index.html';
        };
    };

    $('#pin-submit').click(async function() {
        const pin = $('#pin-input').val();

        $('#error-banner').hide();

        if (pin === '') {
            $('#error-banner').text('Please Enter a Pin').show();
            return;
        };

        if (pin.length !== 4) {
            $('#error-banner').text('Pin must be 4 digits').show();
            return;
        };

        const {data, error} = await supabaseClient.from('participants').select('*').eq('pin', pin).single();
        if (error) {
            $('#error-banner').text('Invalid Pin or Non-Existent Pin').show();
            return;
        };

        if (data.is_admin === true) {
            currentUser = data;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('isLoggedIn', true);

            $('#pin-input').val('');

            loggedInAdmin();
        } else {
            $('#error-banner').text('Access Denied. Admin Access Required').show();
            return;
        };
    });

    $('#logout-button').click(function() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isLoggedIn');
        
        currentUser = null;
        
        $('#pin-input').val('');
        
        $('.logged-in').hide();
        $('.login-prompt').show();
        $('#error-banner').hide();
    });

    $(document).on('click', '.edit-button', function() {
        const participantId = $(this).data('id');
        openEditModal(participantId);
    });

    $('#save-edit').click(async function(e) {
        e.preventDefault(); // Prevent form submission
        await saveParticipantEdit();
    });

    // Also prevent form submission on form submit
    $('#edit-form').on('submit', function(e) {
        e.preventDefault();
        saveParticipantEdit();
    });

    $('#cancel-edit').click(function() {
        closeEditModal();
    });

    $('#edit-giving-to').on('change', function() {
        const selectedValue = $(this).val();

        $('#edit-matched').prop('checked', selectedValue !== '' && selectedValue !== null);
    });

    $('.modal-overlay').click(function(e) {
        if (e.target === this) {
            closeEditModal();
        }
    });

});