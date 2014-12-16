

App = {
    unsynced: [] // unsynced surveys
};

App.init = function(survey) {
    var self = this;
    self.survey = new Survey(survey.survey_id, survey.questions);
    
    $('.nav__sync')
        .click(function() {
            App.sync();
        });
        
        
    // Syncing intervals
    setInterval(function() {
        if (navigator.onLine && self.unsynced.length) {
            _.each(self.unsynced, function(survey) {
                survey.submit();
            });
            self.unsynced = [];
        }
    }, 10000);
    
    // AppCache updates
    window.applicationCache.addEventListener('updateready', function() {
        alert('app updated, reloading...');
        window.location.reload();
    });
};

App.message = function(text) {
    // Shows a message to user
    // E.g. "Your survey has been submitted"
    $('.message')
        .clearQueue()
        .text(text)
        .fadeIn('fast')
        .delay(3000)
        .fadeOut('fast');
};

function Survey(id, questions) {
    var self = this;
    this.id = id;
    this.questions = questions;
    
    // Load answers from localStorage
    var answers = JSON.parse(localStorage[this.id] || '{}');
    _.each(this.questions, function(question) {
        question.answer = answers[question.question_id] || null;
    });
    
    // Page navigation
    $('.page_nav__prev, .page_nav__next').click(function() {
        var offset = this.classList.contains('page_nav__prev') ? -1 : 1;
        var index = $('.content').data('index') + offset;
        if (index >= 0 && index <= self.questions.length) {
            self.render(index);
        }
        return false;
    });
    
    // Render first question
    this.render(0);
};

Survey.prototype.render = function(index) {
    var self = this;
    var question = this.questions[index];
    var content = $('.content');
    
    if (question) {
        // Show widget
        var templateHTML = $('#widget_' + question.type_constraint_name).html();
        var template = _.template(templateHTML);
        var html = template({question: question});
        
        // Render question
        content.empty()
            .data('index', index)
            .html(html);
        
        // Attach widget events
        Widgets[question.type_constraint_name](question, content);
    } else {
        // Show submit page
        content.empty()
            .data('index', index)
            .html($('#template_submit').html())
            .find('.question__btn')
                .one('click', function() {
                    self.submit();
                });
    }
    
    // Update nav
    $('.page_nav__progress')
        .text((index + 1) + ' / ' + (this.questions.length + 1));
};

Survey.prototype.submit = function() {
    var self = this;
    var sync = $('.nav__sync')[0];
    var save_btn = $('.question__saving')[0];
    var answers = {};
    
    // Save answers locally
    _.each(self.questions, function(question) {
        answers[question.question_id] = question.answer;
    });
    localStorage[self.id] = JSON.stringify(answers);

    // Prepare POST request
    var data = {
        survey_id: self.id,
        answers: _.map(self.questions, function(q) {
            console.log('q', q);
            if (typeof q.answer === 'undefined' || q.answer === null) {
                return {
                    question_id: q.question_id,
                    question_choice_id: q.question_choice_id
                };
            } else {
                return {
                    question_id: q.question_id,
                    answer: q.answer
                };
            }
        })
    };
    
    sync.classList.add('icon--spin');
    save_btn.classList.add('icon--spin');
    
    $.post('', {data: JSON.stringify(data)})
        .success(function() {
            App.message('Survey submitted!');
        })
        .fail(function() {
            App.message('Submission failed, will try again later.');
            App.unsynced.push(self);
        })
        .done(function() {
            setTimeout(function() {
                sync.classList.remove('icon--spin');
                save_btn.classList.remove('icon--spin');
                App.message('Survey submitted!');
                self.render(0);
            }, 1000);
        });
};


var Widgets = {};
Widgets.text = function(question, page) {
    // This widget's events. Called after page template rendering.
    // Responsible for setting the question object's answer
    //
    // question: question data
    // page: the widget container DOM element
    $(page)
        .find('input')
        .on('keyup', function() {
            question.answer = this.value;
        });
};

Widgets.integer = function(question, page) {
    $(page)
        .find('input')
        .keyup(function() {
            question.answer = parseInt(this.value);
        });
};

Widgets.location = function(question, page) {
    // TODO: add location status
        
    $(page)
        .find('.question__btn')
        .click(function() {
            navigator.geolocation.getCurrentPosition(
                function success(position) {
                    // Server accepts [lon, lat]
                    var coords = [position.coords.longitude, position.coords.latitude];
                    question.answer = coords;
                    $(page).find('.question__lat').val(coords[1]);
                    $(page).find('.question__lon').val(coords[0]);
                }, function error() {
                    alert('error')
                }, {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0
                });
        });
};

Widgets.multiple_choice = function(question, page) {
    $(page)
        .find('.text_input')
        .hide();
    if(question.logic['with_other']){
        var $other = $(page)
            .find('.text_input')
            .keyup(function() {
                question.question_choice_id = null;
                question.answer = this.value;
            })
            .hide();

        var $select = $(page)
            .find('select')
            .change(function() {
                if (this.value == 'null') {
                    // No option chosen
                    question.question_choice_id = null;
                    question.answer = null;
                    $other.hide();
                } else if (this.value == 'other') {
                    // Choice is text input
                    $other.show();
                    question.question_choice_id = null;
                    question.answer = $other.val();
                } else {
                    // Normal choice
                    question.question_choice_id = this.value;
                    question.answer = null;
                    $other.hide();
                }
            });

        // Set the default/selected option
        var option = question.question_choice_id ||
            (question.answer ? 'other' : 'null');
        $select
            .find('option[value="' + option + '"]')
            .prop('selected', true);
        $select.change();
    } else {
        $(page)
            .find('select')
            .change(function() {
                if (this.value !== ''){
                    question.question_choice_id = this.value;
                } else {
                    question.question_choice_id = undefined;
                }
        });
    }
};

Widgets.decimal = function(question, page) {
    $(page)
        .find('input')
        .keyup(function() {
            question.answer = parseFloat(this.value);
        });
};

Widgets.date = function(question, page) {
    $(page)
        .find('input')
        .keyup(function() {
            if (this.value !== '') {
                question.answer = this.value;
            }
        });
};

Widgets.time = function(question, page) {
    $(page)
        .find('input')
        .keyup(function() {
            if(this.value !== ''){
                question.answer = this.value;
            }
      });
};

Widgets.note = function(question, page) {
};
