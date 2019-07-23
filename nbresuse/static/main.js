define(['jquery', 'base/js/utils', 'require'], function ($, utils, require) {


    var podEviction = function() {
        var evictionTime = null;
        var showedModal = false;
        var countdownEndSequence = false;

        var decrementEvictionTime = function() {
            evictionTime--;
        }

        var setEvictionTime = function(evictionTimeSeconds) {
            evictionTime = evictionTimeSeconds;
        }

        var countDown = function() {
            if (evictionTime > 30) {
                $('.evictTime').text(evictionTime);

                if (!showedModal) {
                    $('#terminateModal').modal('toggle');
                    showedModal = true;
                }

            } else if (countdownEndSequence) {
                // do nothing
                return
            } 
            else {
                $('#terminateModal').modal('hide');
                var skull = '<span id="blink">&#9760;</span>'
                $('#skullface')
                    .replaceWith(skull)
                countdownEndSequence = true;
            }
            decrementEvictionTime();
        }
        
        var appendCountdownElements = function() {
            // add the modal
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

            // add a countdown timer
            var countdown = '<strong> Seconds Until Pod Eviction: </strong><span id="skullface" title="Seconds Til Eviction" class="evictTime"></span>'
            $('#nbresuse-display').append(countdown);
            
            // add blinker style
            var blinker = '<style>#blink { animation: blinker 1s linear infinite; } @keyframes blinker { 50% { opacity: 0; }}</style>'
            $('head').append(blinker);
        }

        return {
            checkForEviction: function() {
                if (document.hidden) {
                    // Don't poll when nobody is looking
                    return;
                }

                $.getJSON(utils.get_body_data('baseUrl') + 'metrics', function(data) {
                    var terminationTime = data['termination'];
        
                    if (terminationTime > 0 && !showedModal) {
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
            
            if (data['gpu'] === 'n/a') {
                $('#nbresuse-gpu').text(data['gpu']);
            } else {
                $('$nbresuse-gpu').text(data['gpu'] + ' GPU');
            }
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
