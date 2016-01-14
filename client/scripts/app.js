'use strict';
require('jointjs/dist/joint.css');
require('../styles/main.css');
window.$ = require('jquery');
var _ = require('lodash');
require('backbone');
var joint = window.joint = require('jointjs');
require('jointjs/dist/joint.shapes.devs');

var url = require('url');

var serverHost = 'localhost:3000';

global.Promise = require('bluebird');
require('whatwg-fetch');
// var request = Promise.promisifyAll(require('request'));

var getComponentList = function() {
    return fetch(url.format({
            protocol: 'http',
            host: serverHost,
            pathname: 'api/Components'
        }), {
            method: 'GET',
            body: null,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(function(res) {
            return res.json();
        });
};
var getGraph = function(id) {
    return fetch(url.format({
            protocol: 'http',
            host: serverHost,
            pathname: 'api/Graphs/' + encodeURIComponent(id)
        }), {
            method: 'GET',
            body: null,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(function(res) {
            return res.json();
        });
};
var getComponent = function(id) {
    return fetch(url.format({
            protocol: 'http',
            host: serverHost,
            pathname: 'api/Components/' + encodeURIComponent(id)
        }), {
            method: 'GET',
            body: null,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(function(res) {
            return res.json();
        });
};

var defaultSize = {
    width: 150,
    height: 150
};

var graph = new joint.dia.Graph;
var paper = new joint.dia.Paper({
    el: $('#paper'),
    width: window.innerWidth,
    height: window.innerHeight,
    gridSize: 1,
    model: graph,
    snapLinks: true,
    linkPinning: false,
    embeddingMode: true,
    validateEmbedding: function(childView, parentView) {
        return parentView.model instanceof joint.shapes.devs.Coupled;
    },
    validateConnection: function(sourceView, sourceMagnet, targetView, targetMagnet) {
        return sourceMagnet !== targetMagnet;
    },
    defaultLink: new joint.dia.Link({
        attrs: {
            '.marker-target': {
                d: 'M 10 0 L 0 5 L 10 10 z'
            }
        }
    }),
    // Enable link snapping within 75px lookup radius
    snapLinks: {
        radius: 75
    }
});



var nfGraph = {
    graphQueues: [],
    processQueue: [],
    linkQueue: [],
    dataQueue: []
};

var setRanksAndConnect = function(connection, nfObj) {
    nfObj = nfObj || nfGraph;
    var source;
    var sourcePort;

    // if we have a data connection, build the data entity and push it to dataQueue
    if (connection.data) {
        var dataIdx = nfObj.dataQueue.length;
        var data = {
            data: connection.data,
            shape: new joint.shapes.devs.Atomic({
                size: defaultSize,
                outPorts: ['out'],
                attrs: {
                    rect: {
                        fill: 'blue'
                    },
                    text: {
                        text: connection.data.toString(),
                        'font-style': 'italic'
                    }
                }
            }),
            rank: 0,
            path: 'dataQueue[' + dataIdx + ']'
        };
        nfObj.dataQueue.push(data)
        source = nfObj.dataQueue[dataIdx];
        sourcePort = 'out';
    } else if (connection.src) {
        source = nfObj.processes[connection.src.process];
        sourcePort = connection.src.port;
    } else {
        console.warn('Connection has neither data nor src:');
        console.dir(connection);
        throw new Error('Connection has neither data nor src');
    }
    var sourceShape = source.shape;
    var target = nfObj.processes[connection.tgt.process];
    var targetPort = connection.tgt.port;
    var targetShape = target.shape;

    if (_.isUndefined(source.rank)) { // if source doesn't have a rank, set it to 1, it's a process
        source.rank = 1;
    }
    if (_.isUndefined(target.rank) || target.rank < source.rank + 1) {
        target.rank = source.rank + 1;
    };

    var linkIdx = nfObj.linkQueue.length;
    var link = {
        isLink: true,
        shape: new joint.shapes.devs.Link({
            source: {
                id: sourceShape.id,
                selector: sourceShape.getPortSelector(sourcePort)
            },
            target: {
                id: targetShape.id,
                selector: targetShape.getPortSelector(targetPort)
            }
        }),
        path: 'linkQueue[' + linkIdx + ']'
    }
    nfObj.linkQueue.push(link);

    return connection;
};

var setPositionFromRank = function(ent, nfObj) {
    nfObj = nfObj || nfGraph;
    if (_.isString(ent)) { // convert paths to entities
        ent = _.get(nfObj, ent);
    }
    while (nfObj.graphQueues.length < ent.rank + 1) {
        nfObj.graphQueues.push([]);
    }
    var rankIdx = nfObj.graphQueues[ent.rank].length;
    nfObj.graphQueues[ent.rank].push(ent.path);
    var x = 50 + (ent.rank) * 250;
    var y = 50 + (rankIdx) * 250;
    ent.shape.position(x, y);
    return ent;
};

var addToGraph = function(ent, nfObj, jjGraph) {
    nfObj = nfObj || nfGraph;
    if (_.isString(ent)) { // convert paths to entities
        ent = _.get(nfObj, ent);
    }
    jjGraph = jjGraph || graph;
    var retShape = ent.shape.addTo(jjGraph);
    if (ent.isLink) {
        retShape.reparent();
    }
    return retShape;
};

Promise.resolve('server/ShowContent3')
    .then(getGraph)
    .then(function function_name(myGraph) {
        _.assign(nfGraph, myGraph);
        return _.map(nfGraph.processes, function(v, k) {
            v.processName = k;
            v.path = 'processes.' + k;
            return v;
        });
    })
    .map(function(process) {
        return getComponent(process.component)
            .then(function(instance) {
                process.instance = instance
                process.shape = new joint.shapes.devs.Atomic({
                    size: defaultSize,
                    inPorts: _.keys(process.instance.inPorts.ports),
                    outPorts: _.keys(process.instance.outPorts.ports),
                    attrs: {
                        text: {
                            text: process.processName
                        }
                    }
                });
                nfGraph.processQueue.push(process.path);
                nfGraph.processes[process.processName] = process;
            })
    })
    .then(function() {
        return nfGraph.connections;
    })
    .map(function(cxn) {
        return setRanksAndConnect(cxn)
    })
    .then(function() {
        return nfGraph.dataQueue.concat(nfGraph.processQueue);
    })
    .map(function(ent) {
        return setPositionFromRank(ent);
    })
    .then(function() {
        return _.flatten(nfGraph.graphQueues).concat(nfGraph.linkQueue);
    })
    .map(function(ent) {
        return addToGraph(ent);
    })
    .catch(function(err) {
        if (err) {
            console.warn(err);
            throw err;
        }
    });
