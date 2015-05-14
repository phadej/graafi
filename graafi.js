(function () {
    /* (c) 2015 Oleg Grenrus MIT-Licensed. */
    'use strict';

    var h = Cycle.h;
    var Rx = Cycle.Rx;
    var svg = Cycle.svg;

    var MINGRADE = 0;
    var MAXGRADE = 3;
    var MINRADIUS = 30;
    var SVGRADIUS = 250;
    var GRAPHRADIUS = 200;

    var MINCOLS = 3;
    var MAXCOLS = 9;

    var MINROWS = 1;
    var MAXVISIBLEROWS = 6;
    var MAXROWS = 30;

    var MAXUNDO = 1000;

    function button(title, disabled, ev) {
        var attributes = {
            'data-click': JSON.stringify(ev || null),
        };
        if (disabled) {
            attributes.disabled = 'disabled';
        }
        return h('button', { attributes: attributes }, title);
    }

    function dataCell(value, colIdx, rowIdx) {
        return h('td', [
            button('-', value <= MINGRADE, { type: 'minus', colIdx: colIdx, rowIdx: rowIdx }),
            ' ' + value + ' ',
            button('+', value >= MAXGRADE, { type: 'plus', colIdx: colIdx, rowIdx: rowIdx }),
        ]);
    }

    var STYLES = [
        'rgba( 51, 102, 153, 0.5)',
        'rgba(153,  51, 102, 0.5)',
        'rgba(102, 153,  51, 0.5)',
        'rgba( 51, 153, 102, 0.5)',
        'rgba(102,  51, 153, 0.5)',
        'rgba(153, 102,  51, 0.5)',
    ];

    var initialState = {
        fields: [
            'FP',
            'OO',
            'Type-safety',
            'Performance',
            'Obscurity',
        ],
        items: [
            { title: 'Haskell', data: [3, 1, 3, 2, 0], visible: true },
            { title: 'JavaScript', data: [2, 2, 0, 1, 2], visible: false },
            { title: 'C', data: [1, 1, 1, 3, 2], visible: true },
        ],
        editable: false
    };

    var initialSystem = {
        state: initialState,
        past: [],
        future: [],
    };

    function isVisible(item) {
        return item.visible;
    }

    function addColumn(newState) {
        var colCount = newState.fields.length;
        newState.fields[colCount] = 'Column ' + (colCount + 1);
        newState.items.forEach(function (item) {
            item.data[colCount] = MINGRADE;
        });
    }

    function removeColumn(newState, colIdx) {
        newState.fields.splice(colIdx, 1);
        newState.items.forEach(function (item) {
            item.data.splice(colIdx, 1);
        });
    }

    function addRow(newState, visibleCount) {
        newState.items.push({
            title: 'Row ' + (newState.items.length + 1),
            data: _.range(newState.fields.length).map(function () { return Math.floor(Math.random() * (MAXGRADE + 1)); }),
            visible: visibleCount < MAXVISIBLEROWS
        });
    }

    function removeRow(newState, rowIdx) {
        newState.items.splice(rowIdx, 1);
    }

    function moveRight(newState, colIdx) {
        var colCount = newState.fields.length;
        var f = _.identity;
        if (colIdx >= colCount - 1) {
            f = function (arr) {
                // add last to beginning
                arr.splice(0, 0, arr.splice(colIdx, 1));
            };
        } else {
            f = function (arr) {
                var tmp = arr[colIdx];
                arr[colIdx] = arr[colIdx + 1];
                arr[colIdx + 1] = tmp;
            };
        }
        f(newState.fields);
        newState.items.forEach(function (item) {
            f(item.data);
        });
    }

    function moveLeft(newState, colIdx) {
        var colCount = newState.fields.length;
        var f = _.identity;
        if (colIdx <= 0) {
            f = function (arr) {
                arr.splice(colCount - 1, 0, arr.splice(0, 1));
            };
        } else {
            f = function (arr) {
                var tmp = arr[colIdx];
                arr[colIdx] = arr[colIdx - 1];
                arr[colIdx - 1] = tmp;
            };
        }
        f(newState.fields);
        newState.items.forEach(function (item) {
            f(item.data);
        });
    }

    function doSave(state) {
        var a = window.document.createElement('a');
        a.href = window.URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'}));
        a.download = 'graafi.json';

        // Append anchor to body.
        document.body.appendChild(a);
        a.click();

        // Remove anchor from body
        document.body.removeChild(a);
    }

    function doLoad(file, contents) {
        try {
            var json = JSON.parse(contents);
            // TODO: validate
            return {
                past: [],
                future: [],
                state: json
            };
        } catch (e) {
            return null;
        }
    }

    function applyEvent(system, ev) {
        var state = system.state;
        var newState = _.cloneDeep(state);
        var visibleItems = state.items.filter(isVisible);
        var visibleCount = visibleItems.length;

        switch (ev.type) {
            case 'undo': return {
                state: system.past[0],
                past: system.past.slice(1),
                future: [state].concat(system.future)
            };
            case 'redo': return {
                state: system.future[0],
                past: [state].concat(system.past),
                future: system.future.slice(1)
            };
            case 'thaw': newState.editable = true; return { state: newState, past: system.past, future: system.future };
            case 'freeze': newState.editable = false; return { state: newState, past: system.past, future: system.future };
            case 'save': doSave(state); return system;
            case 'load': return doLoad(ev.file, ev.contents) || system;
            case 'plus': newState.items[ev.rowIdx].data[ev.colIdx] += 1; break;
            case 'minus': newState.items[ev.rowIdx].data[ev.colIdx] -= 1; break;
            case 'add-col': addColumn(newState); break;
            case 'remove-col': removeColumn(newState, ev.colIdx); break;
            case 'add-row': addRow(newState, visibleCount); break;
            case 'remove-row': removeRow(newState, ev.rowIdx); break;
            case 'move-right': moveRight(newState, ev.colIdx); break;
            case 'move-left': moveLeft(newState, ev.colIdx); break;
            case 'column-header': newState.fields[ev.colIdx] = ev.value; break;
            case 'row-header': newState.items[ev.rowIdx].title = ev.value; break;
            case 'show-hide': newState.items[ev.rowIdx].visible = ev.value; break;
            default:
                /* eslint-disable no-console */
                console.warn('UNKNOWN EVENT', ev);
                /* eslint-enable no-console */
                break;
        }

        return {
            state: newState,
            future: [],
            past: _.take([state].concat(system.past), MAXUNDO) // no unlimited undo
        };
    }

    function render(system) {
        var state = system.state;
        var hasPast = system.past.length > 0;
        var hasFuture = system.future.length > 0;

        var rowCount = state.items.length;
        var colCount = state.fields.length;
        var visibleItems = state.items.filter(isVisible);
        var visibleCount = visibleItems.length;

        var editable = state.editable;

        function calcR(grade) {
            return MINRADIUS + grade / MAXGRADE * (GRAPHRADIUS - MINRADIUS);
        }

        function calcTheta(colIdx) {
            return colIdx / colCount * Math.PI * 2;
        }

        function calcX(r, theta) {
            return Math.floor(r * Math.sin(theta) + SVGRADIUS);
        }

        function calcY(r, theta) {
            return Math.floor(-r * Math.cos(theta) + SVGRADIUS);
        }

        function calcPoint(r, theta) {
            return calcX(r, theta) + ',' + calcY(r, theta);
        }

        var grid1 = _.range(MAXGRADE + 1).map(function (grade) {
            var r = calcR(grade);

            var points = _.range(colCount).map(function (colIdx) {
                var theta = calcTheta(colIdx);
                return calcPoint(r, theta);
            }).join(' ');

            return svg('polygon', {
                attributes: {
                    points: points,
                },
                style: {
                    fill: 'rgba(0,0,0,0)',
                    stroke: 'white',
                    strokeWidth: 1,
                },
            });
        });

        var grid2 = _.range(colCount).map(function (colIdx) {
            var theta = calcTheta(colIdx);

            var r1 = MINRADIUS;
            var r2 = GRAPHRADIUS;

            return svg('line', {
                attributes: {
                    x1: calcX(r1, theta),
                    y1: calcY(r1, theta),
                    x2: calcX(r2, theta),
                    y2: calcY(r2, theta),
                },
                style: {
                    stroke: 'white',
                    strokeWidth: 1
                }
            });
        });

        var titles = state.fields.map(function (field, colIdx) {
            var theta = calcTheta(colIdx);
            var x = calcX(GRAPHRADIUS + 15, theta);
            var y = calcY(GRAPHRADIUS + 15, theta);
            var textTheta = theta > Math.PI / 2 && theta < 3 * Math.PI / 2 ? theta + Math.PI : theta;
            return svg('text', {
                attributes: {
                    x: x,
                    y: y,
                    fill: '#339966',
                    'text-anchor': 'middle',
                    transform: 'rotate(' + (textTheta / Math.PI * 180 + ' ' + x + ',' + y) + ')',
                }
            }, field);
        });

        var otherTitles = visibleItems.map(function (item, rowIdx) {
            return svg('text', {
                attributes: {
                    x: 10,
                    y: rowIdx * 18 + 15,
                    fill: STYLES[rowIdx % STYLES.length],
                    'text-anchor': 'start',
                }
            }, item.title);
        });

        var polygons = visibleItems.map(function (item, itemIdx) {
            var points = item.data.map(function (grade, colIdx) {
                var r = calcR(grade);
                var theta = calcTheta(colIdx);
                return calcPoint(r, theta);
            }).join(' ');

            return svg('polygon', {
                style: { fill: STYLES[itemIdx % STYLES.length] },
                attributes: { points: points }
            });
        });

        var svgElement = svg('svg', {
            style: {
                background: '#c6ece5'
            },
            attributes: {
                height: SVGRADIUS * 2,
                width: SVGRADIUS * 2,
            },
        }, _.flatten([grid1, grid2, titles, otherTitles, polygons]));

        var headerCells = state.fields.map(function (field, colIdx) {
            return h('th', _.flatten([
                [editable ? h('input', {
                    value: field,
                    attributes: {
                        'data-input': JSON.stringify({ type: 'column-header', colIdx: colIdx }),
                    }
                }) : field], editable ? [
                    h('br'),
                    button('←', false, { type: 'move-left', colIdx: colIdx }),
                    button('→', false, { type: 'move-right', colIdx: colIdx }),
                ] : []
            ]));
        });

        var headerRow = h('tr', _.flatten([
            [h('th'), h('th', [
                button('undo', !hasPast, { type: 'undo' }),
                button('redo', !hasFuture, { type: 'redo' }),
            ])],
            headerCells,
            editable ? [h('th', button('add column', colCount >= MAXCOLS, { type: 'add-col' }))] : [],
        ]));

        var footerRow = h('tr', _.flatten([
            [h('td'), h('td', button('add row', rowCount >= MAXROWS, { type: 'add-row' }))],
            _.range(colCount).map(function (colIdx) {
                return h('td', button('remove column', colCount <= MINCOLS, { type: 'remove-col', colIdx: colIdx }));
            }),
            [h('td')],
        ]));

        var dataRows = state.items.map(function (item, rowIdx) {
            var colorIdx = visibleItems.indexOf(item);
            var background = colorIdx === -1 ? 'white' : STYLES[colorIdx % STYLES.length];
            return h('tr', {
                style: {
                    background: background,
                }
            }, _.flatten([
                [
                    h('td', h('input', {
                        checked: item.visible,
                        disabled: !(item.visible ? visibleCount > 1 : visibleCount < MAXVISIBLEROWS),
                        type: 'checkbox',
                        attributes: {
                            'data-checkbox': JSON.stringify({ type: 'show-hide', rowIdx: rowIdx })
                        }
                    })),
                    h('td.rowtitle', editable ? h('input', {
                        value: item.title,
                        attributes: {
                            'data-input': JSON.stringify({ type: 'row-header', rowIdx: rowIdx }),
                        }
                    }) : item.title)
                ],
                item.data.map(function (value, colIdx) {
                    return dataCell(value, colIdx, rowIdx);
                }),
                editable ? [h('td', button('remove row', item.visible ? visibleCount <= MINROWS : rowCount <= MINROWS, { type: 'remove-row', rowIdx: rowIdx }))] : [],
            ]));
        });

        var table = h('table', _.flatten([
            [headerRow],
            dataRows,
            editable ? [footerRow] : [],
        ]));

        var toolbar = h('div.toolbar', [
            button(editable ? 'Freeze' : 'Thaw', false, { type: editable ? 'freeze' : 'thaw' }),
            button('Save', false, { type: 'save' }),
            h('br'),
            h('input#load-file', {
                type: 'file'
            })
        ]);

        var html = h('div', [
            svgElement,
            table,
            toolbar,
        ]);

        return html;
    }

    function computer(interactions) {
        var buttonClicks$ = interactions.get('button', 'click')
            .map(function (ev) {
                return JSON.parse(ev.target.getAttribute('data-click'));
            })
            .filter(_.negate(_.isEmpty));

        var inputs$ = interactions.get('input', 'input')
            .map(function (ev) {
                var el = ev.target;
                var data = JSON.parse(el.getAttribute('data-input'));
                data.value = el.value;
                return data;
            });

        var checkboxes$ = interactions.get('input[type=checkbox]', 'change')
            .map(function (ev) {
                var el = ev.target;
                var data = JSON.parse(el.getAttribute('data-checkbox'));
                data.value = el.checked;
                return data;
            });

        var loadFile$ = interactions.get('input#load-file', 'change')
            .flatMap(function (ev) {
                function f(file, callback) {
                    var reader = new FileReader();
                    reader.onload = function (ev2) {
                        callback({
                            type: 'load',
                            file: file,
                            contents: ev2.target.result
                        });
                    };
                    reader.readAsText(file);
                }

                return Rx.Observable.fromCallback(f)(ev.target.files[0]);
            });

        return Rx.Observable.merge(buttonClicks$, inputs$, checkboxes$, loadFile$)
            .scan(initialSystem, applyEvent)
            .startWith(initialSystem)
            .map(render);
    }

    Cycle.applyToDOM('#container', computer);
})();
