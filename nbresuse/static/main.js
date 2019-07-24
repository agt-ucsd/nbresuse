define(['jquery', 'base/js/utils', 'require'], function ($, utils, require) {

    function setupDOM() {
        // FIXME: Do something cleaner to get styles in here?
        $('#maintoolbar-container').append(
            $('<div>').attr('id', 'nbresuse-display')
                        .addClass('btn-group')
                        .addClass('pull-right')
        )
    
        $('head').append(
            $('<style>').html('.nbresuse-warn { background-color: #FFD2D2; color: #D8000C; }')
        );
        $('head').append(
            $('<style>').html('#nbresuse-display { padding: 2px 8px; }')
        );
    }

    var PodEvictor = function() {
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
                                        '<h4 class="modal-title">Out of Capacity and Pod Eviction Notification</h4>' +
                                    '</div>' +
                                    '<div class="modal-body">' +
                                        '<p class="alert alert-warning"><strong>Warning!</strong> Your pod will evict itself in <span class="evictTime"></span> seconds! Please save and shutdown everything or else risk losing data. <br><br>' +
                                        'Please see the <a href="https://ucsdservicedesk.service-now.com/its?id=kb_article&sys_id=60339445db19f7c49736f35aaf961935#docs-internal-guid-ac5f8859-7fff-a024-499b-79006b03c47c">FAQs</a> for more details.</p>' +
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

    var GPUDisplay = function() {
        var showedDisplay = false;

        var setup = function() {
            $('#nbresuse-display').append(
                $('<strong>').text(' GPU: ')
            ).append(
                $('<span>').attr('id', 'nbresuse-gpu')
                           .attr('title', 'Actively used gpu (updates every 5s)')
            );

            showedDisplay = true;
        }

        var update = function(data) {
            var gpuData = data['gpu'];

            if (gpuData !== 'n/a') {
                if (!showedDisplay) {
                    setup();
                }
                $('#nbresuse-gpu').text(gpuData);
            }
        }

        return {
            update: update
        }
    }

    var MemoryDisplay = function() {
        var showedDisplay = false;

        var setup = function() {
            $('#nbresuse-display').append(
                    $('<strong>').text('Memory: ')
                ).append(
                    $('<span>').attr('id', 'nbresuse-mem')
                                .attr('title', 'Actively used Memory (updates every 5s)')
                )
            
                showedDisplay = true;
        }

        var update = function(data) {
            // FIXME: Proper setups for MB and GB. MB should have 0 things
            // after the ., but GB should have 2.
            if (!showedDisplay) {
                setup();
            }
    
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
        }

        return {
            update: update
        }
    }

    var MetricsHandler = function() {
        var listeners = [];

        /**
         * listener must have an update method
         */
        var registerListener = function(listener) {
            listeners.push(listener)
        }

        var pollMetrics = function() {
            if (document.hidden) {
                // return if no one is watching
                return;
            }
            $.getJSON(utils.get_body_data('baseUrl') + 'metrics', function(data) {
                for (var i = 0; i < listeners.length; i++) {
                    listeners[i].update(data)
                }
            });
        }

        return {
            pollMetrics: pollMetrics,
            registerListener: registerListener
        }
    }

    var load_ipython_extension = function () {
        setupDOM();

        // setup objects
        var podEvictor = PodEvictor();
        var metricsHandler = MetricsHandler();
        var memoryDisplay = MemoryDisplay();
        var gpuDisplay = GPUDisplay();

        metricsHandler.registerListener(memoryDisplay);
        metricsHandler.registerListener(gpuDisplay);

        // start polling processes once immediately
        metricsHandler.pollMetrics();
    
        // start polling processes
        var updateTime = 1000 * 5;
        setInterval(metricsHandler.pollMetrics, updateTime);
        setInterval(podEvictor.checkForEviction, updateTime);

        document.addEventListener("visibilitychange", function() {
            // Update instantly when user activates notebook tab
            // FIXME: Turn off update timer completely when tab not in focus
            if (!document.hidden) {
                metricsHandler.pollMetrics();
            }
        }, false);
    
    };

    return {
        load_ipython_extension: load_ipython_extension,
    };
});
