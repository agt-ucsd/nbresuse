define(['jquery', 'base/js/utils'], function ($, utils) {


    var podEviction = function() {
        var evictionTime = null;
        var showedModal = false;

        var decrementEvictionTime = function() {
            evictionTime--;
        }

        var setEvictionTime = function(evictionTimeSeconds) {
            evictionTime = evictionTimeSeconds;
        }

        var countDown= function() {
            $('.evictTime').text(evictionTime);
            decrementEvictionTime();
        }
        
        var appendCountdownElements = function() {
            // add the modal and make it appear + give it toggability
            var modal = '<div id="terminateModal" class="modal" role="dialog" style="display: none;">' +
                            '<div class="modal-dialog">' +
                                '<div class="modal-content">' +
                                    '<div class="modal-header">' +
                                        '<button type="button" class="close" data-dismiss="modal">&times;</button>' +
                                        '<h4 class="modal-title">Pod Eviction Notification</h4>' +
                                    '</div>' +
                                    '<div class="modal-body">' +
                                        '<p class="alert alert-warning"><strong>Warning!</strong> Your pod will evict itself in <span class="evictTime"></span> seconds! Please save and shutdown everything or else risk losing data.</p>' +
                                    '</div>' +
                                    '<div class="modal-footer">' +
                                        '<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>';
            $('body').append(modal);
            $('#terminateModal').modal('toggle');
    
            // add a countdown timer
            var countdown = '<strong> Seconds until Eviction: </strong><span title="Seconds Til Eviction" class="evictTime"></span>'
            $('#nbresuse-display').append(countdown);
        }

        return {
            checkForEviction: function() {
                if (document.hidden) {
                    // Don't poll when nobody is looking
                    return;
                }

                $.getJSON(utils.get_body_data('baseUrl') + 'metrics', function(data) {
                    console.log('inside here');
                    var terminationTime = data['termination'];
        
                    if (terminationTime > 0 && !showedModal) {
                        showedModal = true;
                        setEvictionTime(terminationTime);
                        
                        appendCountdownElements();

                        setInterval(countDown, 1000);
                    }
                });
            }
        }
    }

    function setupDOM() {
        $('#maintoolbar-container').append(
            $('<div>').attr('id', 'nbresuse-display')
                      .addClass('btn-group')
                      .addClass('pull-right')
            .append(
                $('<strong>').text('Memory: ')
            ).append(
                $('<span>').attr('id', 'nbresuse-mem')
                           .attr('title', 'Actively used Memory (updates every 5s)')
            )
            .append(
                $('<strong>').text(' GPU: ')
            ).append(
                $('<span>').attr('id', 'nbresuse-gpu')
                           .attr('title', 'Actively used gpu (updates every 5s)')
            )
        );
        // FIXME: Do something cleaner to get styles in here?
        $('head').append(
            $('<style>').html('.nbresuse-warn { background-color: #FFD2D2; color: #D8000C; }')
        );
        $('head').append(
            $('<style>').html('#nbresuse-display { padding: 2px 8px; }')
        );
    }

    var displayMetrics = function() {
        if (document.hidden) {
            // Don't poll when nobody is looking
            return;
        }
        $.getJSON(utils.get_body_data('baseUrl') + 'metrics', function(data) {
            // FIXME: Proper setups for MB and GB. MB should have 0 things
            // after the ., but GB should have 2.
            var display = Math.round(data['rss'] / (1024 * 1024));

            var limits = data['limits'];
            if ('memory' in limits) {
                if ('rss' in limits['memory']) {
                    display += " / " + (limits['memory']['rss'] / (1024 * 1024));
                }
                if (limits['memory']['warn']) {
                    $('#nbresuse-display').addClass('nbresuse-warn');
                } else {
                    $('#nbresuse-display').removeClass('nbresuse-warn');
                }
            }
            if (data['limits']['memory'] !== null) {
            }
            $('#nbresuse-mem').text(display + ' MB');
            
            $('#nbresuse-gpu').text(data['gpu'] + ' GPU')
        });
    }


    var load_ipython_extension = function () {
        var updateTime = 1000 * 5;
        setupDOM();
        displayMetrics();

        var podEvictor = podEviction();

        // Update every five seconds, eh?
        setInterval(displayMetrics, updateTime);
        setInterval(podEvictor.checkForEviction, updateTime);

        document.addEventListener("visibilitychange", function() {
            // Update instantly when user activates notebook tab
            // FIXME: Turn off update timer completely when tab not in focus
            if (!document.hidden) {
                displayMetrics();
            }
        }, false);
    };

    return {
        load_ipython_extension: load_ipython_extension,
    };
});
