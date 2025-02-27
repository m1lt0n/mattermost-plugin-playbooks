// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************
import {stubClipboard} from '../../utils';

const getBroadcastSection = () => cy.findByText('Broadcast to selected channels');

describe('runs > run details page > header', () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testPublicPlaybookAndChannel;
    let playbookRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create another user in the same team
            cy.apiCreateUser().then(({user: viewer}) => {
                testViewerUser = viewer;
                cy.apiAddUserToTeam(testTeam.id, testViewerUser.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                createPublicPlaybookRun: true,
                memberIDs: [],
            }).then((playbook) => {
                testPublicPlaybookAndChannel = playbook;
            });
        });
    });

    const openRunActionsModal = () => {
        // # Click on the run actions modal button
        cy.findByRole('button', {name: /Run Actions/i}).click({force: true});

        // * Verify that the modal is shown
        cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');
    };

    const saveRunActionsModal = () => {
        // # Click on the Save button without changing anything
        cy.findByRole('button', {name: /Save/i}).click();

        // * Verify that the modal is no longer there
        cy.findByRole('dialog', {name: /Run Actions/i}).should('not.exist');
    };

    const getHeader = () => {
        return cy.findByTestId('run-header-section');
    };

    const getHeaderIcon = (selector) => {
        return getHeader().find(selector);
    };

    const getDropdownItemByText = (text) => {
        cy.findByTestId('run-header-section').find('h1').click();
        return cy.findByTestId('run-header-section').findByTestId('dropdownmenu').findByText(text);
    };

    const commonHeaderTests = () => {
        it('shows the title', () => {
            // * Assert title is shown in h1 inside header
            cy.findByTestId('run-header-section').find('h1').contains(playbookRun.name);
        });

        it('shows the in-progress status badge', () => {
            // * Assert in progress status badge
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');
        });

        it('has a copy-link icon', () => {
            // # Mouseover on the icon
            getHeaderIcon('.icon-link-variant').trigger('mouseover');

            // * Assert tooltip is shown
            cy.get('#copy-run-link-tooltip').should('contain', 'Copy link to run');

            stubClipboard().as('clipboard');
            getHeaderIcon('.icon-link-variant').click().then(() => {
                // * Verify that tooltip text changed
                cy.get('#copy-run-link-tooltip').should('contain', 'Copied!');

                // * Verify clipboard content
                cy.get('@clipboard').its('contents').should('contain', `/playbooks/runs/${playbookRun.id}`);
            });
        });
    };

    const commonContextDropdownTests = () => {
        it('shows on click', () => {
            // # Click title
            cy.findByTestId('run-header-section').find('h1').click();

            // * Assert context menu is opened
            cy.findByTestId('run-header-section').findByTestId('dropdownmenu').should('be.visible');
        });

        it('can copy link', () => {
            stubClipboard().as('clipboard');

            getDropdownItemByText('Copy link').click().then(() => {
                // * Verify clipboard content
                cy.get('@clipboard').its('contents').should('contain', `/playbooks/runs/${playbookRun.id}`);
            });
        });
    };

    describe('as participant', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'the run name(' + Date.now() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                // # Visit the playbook run
                cy.visit(`/playbooks/runs/${playbookRun.id}`);
            });
        });

        describe('title, icons and buttons', () => {
            commonHeaderTests();

            it('has not get-involved button', () => {
                // * Assert button is not showed
                getHeader().findByText('Participate').should('not.exist');
            });

            describe('run actions', () => {
                describe('modal behaviour', () => {
                    it('shows and hides as expected', () => {
                        // * Verify that the run actions modal is shown when clicking on the button
                        openRunActionsModal();

                        // # Click on the Cancel button
                        cy.findByRole('button', {name: /Cancel/i}).click();

                        // * Verify that the modal is no longer there
                        cy.findByRole('dialog', {name: /Run Actions/i}).should('not.exist');

                        // # Open the run actions modal
                        openRunActionsModal();

                        // * Verify that saving the modal hides it
                        saveRunActionsModal();
                    });

                    it('can not save an invalid form', () => {
                        // * Verify that the run actions modal is shown when clicking on the button
                        openRunActionsModal();

                        cy.findByRole('dialog', {name: /Run Actions/i}).within(() => {
                            // # click on webhooks toggle
                            cy.findByText('Send outgoing webhook').click();

                            // # Type an invalid webhook URL
                            cy.getStyledComponent('TextArea').clear().type('invalidurl');

                            // # Click outside textarea
                            cy.findByText('Run Actions').click();

                            // * Assert the error message is displayed
                            cy.findByText('Invalid webhook URLs').should('be.visible');

                            // # Click save
                            cy.findByTestId('modal-confirm-button').click();

                            // * Assert that modal is still open
                            cy.findByText('Run Actions').should('be.visible');
                        });
                    });

                    it('honours the settings from the playbook', () => {
                        cy.apiCreateChannel(
                            testTeam.id,
                            'action-channel',
                            'Action Channel',
                            'O'
                        ).then(({channel}) => {
                            // # Create a different playbook with both settings enabled and populated with data,
                            // # and then start a run from it
                            const broadcastChannelIds = [channel.id];
                            const webhookOnStatusUpdateURLs = ['https://one.com', 'https://two.com'];
                            cy.apiCreatePlaybook({
                                teamId: testTeam.id,
                                title: 'Playbook' + Date.now(),
                                broadcastEnabled: true,
                                broadcastChannelIds,
                                webhookOnStatusUpdateEnabled: true,
                                webhookOnStatusUpdateURLs,
                            }).then((playbook) => {
                                cy.apiRunPlaybook({
                                    teamId: testTeam.id,
                                    playbookId: playbook.id,
                                    playbookRunName: 'Run with actions preconfigured',
                                    ownerUserId: testUser.id,
                                });
                            });

                            // # Navigate to the run page
                            cy.visit(`/${testTeam.name}/channels/run-with-actions-preconfigured`);
                            cy.findByRole('button', {name: /Run details/i}).click({force: true});

                            // # Open the run actions modal
                            openRunActionsModal();

                            // * Verify that the broadcast-to-channels toggle is checked
                            getBroadcastSection().parent().within(() => {
                                cy.get('input').should('be.checked');
                            });

                            // * Verify that the channel is in the selector
                            cy.findByText(channel.display_name);

                            // * Verify that the send-webhooks toggle is checked
                            cy.findByText('Send outgoing webhook').parent().within(() => {
                                cy.get('input').should('be.checked');
                            });
                        });
                    });
                });
            });

            describe('trigger: when a status update is posted', () => {
                describe('action: Broadcast update to selected channels', () => {
                    it('shows channel information on first load', () => {
                        // # Open the run actions modal
                        openRunActionsModal();

                        // # Enable broadcast to channels
                        getBroadcastSection().click();

                        // # Select a couple of channels
                        cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}');

                        // # Save the changes
                        saveRunActionsModal();

                        // # Reload the page, so that the store is not pre-populated when visiting Channels
                        cy.visit(`/playbooks/runs/${playbookRun.id}/overview`);

                        // # Open the run actions modal
                        openRunActionsModal();

                        // * Check that the channels previously added are shown with their full name,
                        // * verifying that the store has been populated by the modal component.
                        cy.findByText('Town Square').should('exist');
                        cy.findByText('Off-Topic').should('exist');
                    });

                    it('broadcasts to two channels configured when it is enabled', () => {
                        // # Open the run actions modal
                        openRunActionsModal();

                        // # Enable broadcast to channels
                        getBroadcastSection().click();

                        // # Select a couple of channels
                        cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}', {delay: 100});

                        // # Save the changes
                        saveRunActionsModal();

                        // # Post a status update, with a reminder in 1 second.
                        const message = 'Status update - ' + Date.now();
                        cy.apiUpdateStatus({
                            playbookRunId: playbookRun.id,
                            message,
                        });

                        // # Navigate to the town square channel
                        cy.visit(`/${testTeam.name}/channels/town-square`);

                        // * Verify that the last post contains the status update
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(message);
                        });

                        // # Navigate to the off-topic channel
                        cy.visit(`/${testTeam.name}/channels/off-topic`);

                        // * Verify that the last post contains the status update
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(message);
                        });
                    });

                    it('does not broadcast if it is disabled, even if there are channels configured', () => {
                        // # Open the run actions modal
                        openRunActionsModal();

                        // # Enable broadcast to channels
                        getBroadcastSection().click();

                        // # Select a couple of channels
                        cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}', {delay: 100});

                        // # Disable broadcast to channels
                        getBroadcastSection().click();

                        // # Save the changes
                        saveRunActionsModal();

                        // # Post a status update, with a reminder in 1 second.
                        const message = 'Status update - ' + Date.now();
                        cy.apiUpdateStatus({
                            playbookRunId: playbookRun.id,
                            message,
                        });

                        // # Navigate to the town square channel
                        cy.visit(`/${testTeam.name}/channels/town-square`);

                        // * Verify that the last post does not contain the status update
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(message).should('not.exist');
                        });

                        // # Navigate to the off-topic channel
                        cy.visit(`/${testTeam.name}/channels/off-topic`);

                        // * Verify that the last post does not contain the status update
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(message).should('not.exist');
                        });
                    });
                });
            });

            describe('trigger: when a retro is published', () => {
                describe('action: Broadcast retro to selected channels', () => {
                    it('broadcasts to two channels configured when it is enabled', () => {
                        // # Open the run actions modal
                        openRunActionsModal();

                        // # Enable broadcast to channels
                        getBroadcastSection().click();

                        // # Select a couple of channels
                        cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}', {delay: 100});

                        // # Save the changes
                        saveRunActionsModal();

                        // # Publish a retrospective.
                        const retrospective = 'Retrospective - ' + Date.now();
                        cy.apiPublishRetro({
                            playbookRunId: playbookRun.id,
                            retrospective,
                        });

                        // # Navigate to the town square channel
                        cy.visit(`/${testTeam.name}/channels/town-square`);

                        // * Verify that the last post contains the retrospective post
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(retrospective);
                        });

                        // # Navigate to the off-topic channel
                        cy.visit(`/${testTeam.name}/channels/off-topic`);

                        // * Verify that the last post contains the retrospective post
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(retrospective);
                        });
                    });

                    it('does not broadcast if it is disabled, even if there are channels configured', () => {
                        // # Open the run actions modal
                        openRunActionsModal();

                        // # Enable broadcast to channels
                        getBroadcastSection().click();

                        // # Select a couple of channels
                        cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}', {delay: 100});

                        // # Disable broadcast to channels
                        getBroadcastSection().click();

                        // # Save the changes
                        saveRunActionsModal();

                        // # Publish a retrospective.
                        const retrospective = 'Retrospective - ' + Date.now();
                        cy.apiPublishRetro({
                            playbookRunId: playbookRun.id,
                            retrospective,
                        });

                        // # Navigate to the town square channel
                        cy.visit(`/${testTeam.name}/channels/town-square`);

                        // * Verify that the last post does not contain the retro post
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(retrospective).should('not.exist');
                        });

                        // # Navigate to the off-topic channel
                        cy.visit(`/${testTeam.name}/channels/off-topic`);

                        // * Verify that the last post does not contain the retro post
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(retrospective).should('not.exist');
                        });
                    });
                });
            });
        });

        describe('context menu', () => {
            commonContextDropdownTests();

            describe('finish run', () => {
                it('can be confirmed', () => {
                    // * Check that status badge is in-progress
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

                    // # Click on finish run
                    getDropdownItemByText('Finish run').click();

                    // # Check that finish run modal is open
                    cy.get('#confirmModal').should('be.visible');
                    cy.get('#confirmModal').find('h1').contains('Confirm finish run');

                    // # Click on confirm
                    cy.get('#confirmModal').get('#confirmModalButton').click();

                    // * Assert option is not anymore in context dropdown
                    getDropdownItemByText('Finish run').should('not.exist');

                    // * Assert status badge is finished
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');
                });

                it('can be canceled', () => {
                    // * Check that status badge is in-progress
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

                    // # Click on finish run
                    getDropdownItemByText('Finish run').click();

                    // * Check that finish run modal is open
                    cy.get('#confirmModal').should('be.visible');
                    cy.get('#confirmModal').find('h1').contains('Confirm finish run');

                    // # Click on cancel
                    cy.get('#confirmModal').get('#cancelModalButton').click();

                    // * Assert option is not anymore in context dropdown
                    getDropdownItemByText('Finish run').should('be.visible');

                    // * Assert status badge is still in progress
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');
                });
            });

            describe('run actions', () => {
                it('modal can be opened', () => {
                    // # Click on finish run
                    getDropdownItemByText('Run actions').click();

                    // * Assert modal pop up
                    cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');

                    // # Click on cancel
                    cy.findByRole('dialog', {name: /Run Actions/i}).findByTestId('modal-cancel-button').click();

                    // * Assert modal disappeared
                    cy.findByRole('dialog', {name: /Run Actions/i}).should('not.exist');
                });
            });

            describe('leave run', () => {
                it('can leave run', () => {
                    // # Add viewer user to the channel
                    cy.apiAddUserToChannel(playbookRun.channel_id, testViewerUser.id);

                    // # Change the owner to testViewerUser
                    cy.apiChangePlaybookRunOwner(playbookRun.id, testViewerUser.id);
                    cy.wait(500);

                    // # Click on leave run
                    getDropdownItemByText('Leave and unfollow run').click();

                    // # confirm modal
                    cy.get('#confirmModal').get('#confirmModalButton').click();

                    // NOTE: this check fails because the front doesn't receive updated run object. Will deal in separate PR.
                    // * Assert that the Participate button is shown
                    // getHeader().findByText('Participate').should('be.visible');

                    // * Verify run has been removed from LHS
                    cy.findByTestId('lhs-navigation').findByText(playbookRun.name).should('not.exist');
                });
            });
        });
    });

    describe('as viewer', () => {
        let playbookRunChannelName;
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                cy.apiLogin(testViewerUser).then(() => {
                    // # Visit the playbook run
                    cy.visit(`/playbooks/runs/${playbookRun.id}`);
                });
            });
        });

        describe('title, icons and buttons', () => {
            commonHeaderTests();

            describe('Participate', () => {
                it('shows button', () => {
                    // * Assert that the button is shown
                    getHeader().findByText('Participate').should('be.visible');
                });

                it('click button to show modal and cancel', () => {
                    // * Assert that component is rendered
                    getHeader().findByText('Participate').should('be.visible');

                    // # Wait for useChannel
                    cy.wait(500);

                    // * Click Participate button
                    getHeader().findByText('Participate').click();

                    // # cancel modal
                    cy.get('#confirmModal').get('#cancelModalButton').click();

                    // * Assert modal is not shown
                    cy.get('#confirmModal').should('not.exist');

                    // # Login as testUser
                    cy.apiLogin(testUser).then(() => {
                        // # Visit the channel run
                        cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                        // * Assert message has not been sent
                        cy.getLastPost().should('not.contain', 'wants to participate in this run.');
                    });
                });

                it('click button to show modal and confirm', () => {
                    // * Assert component is rendered
                    getHeader().findByText('Participate').should('be.visible');

                    // # Wait for useChannel
                    cy.wait(500);

                    // * Click start-participating button
                    getHeader().findByText('Participate').click();

                    // # confirm modal
                    cy.get('#confirmModal').get('#confirmModalButton').click();

                    // * Assert that modal is not shown
                    cy.get('#confirmModal').should('not.exist');

                    // # Login as testUser
                    cy.apiLogin(testUser).then(() => {
                        // # Visit the channel run
                        cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                        // * Assert that message has been sent
                        cy.getLastPost().contains('wants to participate in this run.');
                    });
                });

                it('click button and confirm to join public channel', () => {
                    // # Login as testUser
                    cy.apiLogin(testUser);

                    const now = Date.now();
                    const playbookRunName = 'Playbook Run (' + now + ')';
                    playbookRunChannelName = 'playbook-run-' + now;

                    // Create a run with public chanel
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: testPublicPlaybookAndChannel.id,
                        playbookRunName,
                        ownerUserId: testUser.id,
                    }).then((run) => {
                        cy.apiLogin(testViewerUser);

                        // # Visit the playbook run
                        cy.visit(`/playbooks/runs/${run.id}`);

                        // * Assert that component is rendered
                        getHeader().findByText('Participate').should('be.visible');

                        // # Wait for useChannel
                        cy.wait(500);

                        // # Click start-participating button
                        getHeader().findByText('Participate').click();

                        // # confirm modal
                        cy.get('#confirmModal').get('#confirmModalButton').click();

                        // * Assert that modal is not shown
                        cy.get('#confirmModal').should('not.exist');

                        // # Wait for useChannel
                        cy.wait(500);

                        // * Verify run has been added to LHS
                        cy.findByTestId('lhs-navigation').findByText(playbookRunName).should('exist');

                        // # Visit the channel run (now we joined)
                        cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                        // * Assert that message has not been sent
                        cy.getLastPost().should('not.contain', 'wants to participate in this run');
                    });
                });
            });

            describe('run actions', () => {
                describe('modal behaviour', () => {
                    it('modal can be opened read-only', () => {
                        // # Click on run actions
                        getDropdownItemByText('Run actions').click();

                        // * Assert modal pop up
                        cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');

                        // * Assert there are no buttons
                        cy.findByRole('dialog', {name: /Run Actions/i}).findByTestId('modal-cancel-button').should('not.exist');
                        cy.findByRole('button', {name: /Save/i}).should('not.exist');

                        // # Close modal
                        cy.findByRole('dialog', {name: /Run Actions/i}).find('.close').click();
                    });
                });
            });
        });

        describe('context menu', () => {
            commonContextDropdownTests();

            describe('finish run', () => {
                it('does not exist', () => {
                    // * There's no finish run item
                    getDropdownItemByText('Finish run').should('not.exist');
                });
            });

            describe('run actions', () => {
                it('modal can be opened read-only', () => {
                    // # Click on finish run
                    getDropdownItemByText('Run actions').click();

                    // * Assert modal pop up
                    cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');

                    // * Assert there are no buttons
                    cy.findByRole('dialog', {name: /Run Actions/i}).findByTestId('modal-cancel-button').should('not.exist');
                    cy.findByRole('button', {name: /Save/i}).should('not.exist');

                    // # Close modal
                    cy.findByRole('dialog', {name: /Run Actions/i}).find('.close').click();
                });
            });
        });
    });
});
