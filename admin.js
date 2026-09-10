jQuery(document).ready(function($) {
    let currentUser = null;
    let allParticipants = null;
    let allPairings = null;

    function clearSession() {
        API.logout();
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isLoggedIn');
        currentUser = null;
    }

    async function loggedInAdmin() {
        $('.login-prompt').hide();
        $('.logged-in').show();
        $('#welcome-message').text(`Hello ${currentUser.name}!`);

        await fetchPairings();
        buildParticipantsTable();
    };

    async function fetchPairings() {
        try {
            const data = await API.adminParticipants();
            allParticipants = data.participants;
            allPairings = data.pairings;
        } catch (error) {
            console.log('Error Fetching Participants:', error);
            allParticipants = [];
            allPairings = [];
            if (error.status === 401 || error.status === 403) {
                clearSession();
                $('.logged-in').hide();
                $('.login-prompt').show();
                $('#error-banner').text(error.message).show();
            }
        }
    };

    function buildParticipantsTable() {
        const tableBody = $('#participants-table-body');
        tableBody.empty();

        if (!allParticipants || allParticipants.length === 0) {
            tableBody.append('<tr><td colspan="6">No participants found</td></tr>');
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

        if (!participantId) {
            alert('Error: Participant ID is missing. Please try again.');
            return;
        }

        try {
            await API.updateParticipant(participantId, {
                name: name,
                matched: matched,
                family_group: familyGroup,
                is_admin: isAdmin,
                receiver_id: givingToId === '' ? null : givingToId,
            });
            await fetchPairings();
            buildParticipantsTable();
            closeEditModal();
        } catch (error) {
            console.log('Error Updating Participant:', error);
            alert('Failed to update participant: ' + error.message);
        }
    };

    function closeEditModal() {
        $('#edit-modal').hide();
        $('#edit-form')[0].reset();
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

        try {
            const user = await API.login(pin);
            if (user.is_admin !== true) {
                API.logout();
                $('#error-banner').text('Access Denied. Admin Access Required').show();
                return;
            }

            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('isLoggedIn', true);
            $('#pin-input').val('');
            loggedInAdmin();
        } catch (error) {
            $('#error-banner').text(error.message || 'Invalid Pin or Non-Existent Pin').show();
        }
    });

    $('#logout-button').click(function() {
        clearSession();
        
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
        e.preventDefault();
        await saveParticipantEdit();
    });

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

    async function restoreAdminSession() {
        if (!API.token) {
            return;
        }

        try {
            const data = await API.me();
            if (data.user.is_admin !== true) {
                window.location.href = 'index.html';
                return;
            }
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('isLoggedIn', true);
            loggedInAdmin();
        } catch (error) {
            clearSession();
        }
    }

    restoreAdminSession();
});
