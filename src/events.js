/**
 * events.js - Event emitter for HumanInput
 * Copyright (c) 2016, Dan McDougall
 * @link https://github.com/liftoff/HumanInput
 * @license Apache-2.0
 */

// import { Promise } from 'es6-promise-polyfill';
import { isUpper, isEqual, normEvents } from './utils';

export class EventHandler {

    constructor(logger) {
        var self = this;
        // Built-in aliases
        self.aliases = {
            tap: 'click',
            taphold: 'hold:1500:pointer:left',
            clickhold: 'hold:1500:pointer:left',
            middleclick: 'pointer:middle',
            rightclick: 'pointer:right',
            doubleclick: 'dblclick', // For consistency with naming
            konami: 'up up down down left right left right b a enter',
            portrait: 'window:orientation:portrait',
            landscape: 'window:orientation:landscape',
            hulksmash: 'faceplant',
            twofingertap: 'multitouch:2:tap',
            threefingertap: 'multitouch:3:tap',
            fourfingertap: 'multitouch:4:tap'
        };
        self.events = {};
        self.log = logger; // NOTE: The logger must already be instantiated
        // Handy aliases
        self.one = self.once; // Handy dandy alias so jQuery folks don't get confused =)
        self.emit = self.trigger; // Some people prefer 'emit()'; we can do that!
    }

    get eventCount() {
        var i = 0;
        for (let item in this.events) {
            i++;
        }
        return i;
    }

    _handleAliases(event) {
        // DRY function to handle swapping out event aliases and making sure 'shift-' gets added where necessary
        event = this.aliases[event] || event; // Resolve any aliases
        if (event.length === 1 && isUpper(event)) { // Convert uppercase chars to shift-<key> equivalents
            event = 'shift-' + event;
        }
        return event;
    }

    on(events, callback, context, times) {
        var self = this;
        normEvents(events).forEach(function(event) {
            if (event.includes(':')) { // Contains a scope (or other divider); we need to split it up to resolve aliases
                var splitChar = ':';
            } else if (event.includes(' ')) { // It's (likely) a sequence
                var splitChar = ' ';
            }
            if (splitChar) { // NOTE: This won't hurt anything if we accidentally matched on something in quotes
                let splitRegex = new RegExp(splitChar + '(?=(?:(?:[^"]*"){2})*[^"]*$)', 'g');
                let splitEvents = event.split(splitRegex);
                event = '';
                for (let i=0; i < splitEvents.length; i++) {
                    event += self._handleAliases(splitEvents[i]) + splitChar;
                }
                event = event.replace(new RegExp(splitChar + '+$'), ""); // Remove trailing colons
            } else {
                event = self._handleAliases(event);
            }
            event = event.toLowerCase(); // All events are normalized to lowercase for consistency
            if (event.includes('-')) { // Combo
                if (event.includes('->')) {
                    // Pre-sort non-ordered combos
                    event = self._normCombo(event);
                }
            }
            // Force an empty object as the context if none given (simplifies things)
            if (!context) { context = {}; }
            var callList = self.events[event];
            var callObj = {
                callback: callback,
                context: context,
                times: times
            };
            if (!callList) {
                callList = self.events[event] = [];
            }
            callList.push(callObj);
        });
        return self;
    }

    once(events, callback, context) {
        return this.on(events, callback, context, 1);
    }

    off(events, callback, context) {
        var self = this;
        if (!arguments.length) { // Called with no args?  Remove all events:
            self.events = {};
        } else {
            events = events ? normEvents(events) : Object.keys(self.events);
            for (const i of events) {
                var event = events[i];
                var callList = self.events[event];
                if (callList) {
                    let newList = [];
                    if (!context) {
                        if (!callback) { // No context or callback? Just delete the event and be done:
                            delete self.events[event];
                            break;
                        }
                    }
                    for (let n = 0; n < callList.length; n++) {
                        if (callback) {
                             if (callList[n].callback.toString() == callback.toString()) {
                                // Functions are the same but are the contexts?  Let's check...
                                if ((context === null || context === undefined) && callList[n].context) {
                                    newList.push(callList[n]);
                                } else if (!isEqual(callList[n].context, context)) {
                                    newList.push(callList[n]);
                                }
                             } else {
                                newList.push(callList[n]);
                             }
                        } else if (context && callList[n].context !== context) {
                            newList.push(callList[n]);
                        }
                    }
                    if (!newList.length) {
                        delete self.events[event];
                    } else {
                        self.events[event] = newList;
                    }
                }
            }
        }
        return self;
    }

    trigger(events) {
        var self = this;
        var results = []; // Did we successfully match and trigger an event?
        var args = Array.from(arguments).slice(1);
        normEvents(events).forEach(function(event) {
            event = self.aliases[event] || event; // Apply the alias, if any
            event = self.eventMap.forward[event] || event; // Apply any event re-mapping
            self.log.debug('Triggering:', event, args.length ? args : '');
            if (self.recording) { recordedEvents.push(event); }
            let callList = self.events[event];
            if (callList) {
                for (let i=0; i < callList.length; i++) {
                    let callObj = callList[i];
                    if (callObj.context !== window) {
                    // Only update the context with HIEvent if it's not the window (no messing with global namespace!)
                        callObj.context.HIEvent = event;
                    }
                    if (callObj.times) {
                        callObj.times -= 1;
                        if (callObj.times === 0) {
                            self.off(event, callObj.callback, callObj.context);
                        }
                    }
                    results.push(callObj.callback.apply(callObj.context || this, args));
                }
            }
        });
        return results;
    }
}