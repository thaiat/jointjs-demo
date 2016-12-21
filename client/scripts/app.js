'use strict';
require('../styles/main.css');
var _ = require('lodash');
global.Promise = require('bluebird');
var go = require('gojs/release/go-debug');
var url = require('url');

var serverHost = 'localhost:3000';

require('whatwg-fetch');

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

var $ = go.GraphObject.make;
var myDiagram = $(go.Diagram, 'myDiagramDiv', {
    initialContentAlignment: go.Spot.Left,
    initialAutoScale: go.Diagram.UniformToFill,
    layout: $(go.LayeredDigraphLayout, {
        direction: 0
    }),
    'undoManager.isEnabled': true // enable Ctrl-Z to undo and Ctrl-Y to redo
});


var makePort = function makePort(name, opts) {
    var port = $(go.Shape, 'Rectangle', {
        fill: 'gray',
        stroke: null,
        strokeWidth: 0,
        desiredSize: new go.Size(8, 8),
        portId: name, // declare this object to be a 'port'
        toMaxLinks: 1, // don't allow more than one link into a port
        cursor: 'pointer' // show a different cursor to indicate potential link point
    });
    var lab = $(go.TextBlock, name, // the name of the port
        {
            font: '7pt sans-serif'
        });
    var panel = $(go.Panel, 'Horizontal', {
        margin: new go.Margin(2, 0)
    });
    if (opts.isInPort) {
        port.toSpot = go.Spot.Left;
        port.toLinkable = true;
        lab.margin = new go.Margin(1, 0, 0, 1);
        panel.alignment = go.Spot.TopLeft;
        panel.add(port);
        panel.add(lab);
    } else {
        port.fromSpot = go.Spot.Right;
        port.fromLinkable = true;
        lab.margin = new go.Margin(1, 1, 0, 0);
        panel.alignment = go.Spot.TopRight;
        panel.add(lab);
        panel.add(port);
    }
    return panel;
};
var makeTemplate = function makeTemplate(component, background, inPorts, outPorts) {
    var node = $(go.Node, 'Spot',
                $(go.Panel, 'Auto', {
                        width: 100,
                        height: 120
                    },
                    $(go.Shape, 'Rectangle', {
                        fill: background,
                        stroke: null,
                        strokeWidth: 0,
                        spot1: go.Spot.TopLeft,
                        spot2: go.Spot.BottomRight
                    }),
                    $(go.Panel, 'Table',
                        $(go.TextBlock, {
                                row: 0,
                                margin: 3,
                                editable: true,
                                maxSize: new go.Size(80, 40),
                                stroke: 'white',
                                font: 'bold 11pt sans-serif'
                            },
                            new go.Binding('text', 'name').makeTwoWay()),
                        $(go.TextBlock, component, {
                            row: 1,
                            margin: 3,
                            maxSize: new go.Size(80, NaN),
                            stroke: 'white',
                            font: 'italic 9pt sans-serif'
                        })
                    )
                ),
                $(go.Panel, 'Vertical', {
                        alignment: go.Spot.Left,
                        alignmentFocus: new go.Spot(0, 0.5, -8, 0)
                    },
                    inPorts)
                    ,
                $(go.Panel, 'Vertical', {
                        alignment: go.Spot.Right,
                        alignmentFocus: new go.Spot(1, 0.5, 8, 0)
                    },
                    outPorts)
            );
            myDiagram.nodeTemplateMap.add(component, node);
};
var makeComponentTemplate = function makeComponentTemplate(component) {
    return getComponent(component)
        .then(function(instance) {
            var inPorts = _.map(_.keys(instance.inPorts.ports), _.curryRight(makePort, true));
            var outPorts = _.map(_.keys(instance.outPorts.ports), _.curryRight(makePort, false));
            makeTemplate(component, "cornflowerblue", inPorts, outPorts);
        });
};

// make template for data objects
makeTemplate('Data', 'mediumpurple', [], [makePort('', false)]);

myDiagram.linkTemplate = $(go.Link, {
        routing: go.Link.Orthogonal,
        corner: 5,
        relinkableFrom: true,
        relinkableTo: true
    },
    $(go.Shape, {
        stroke: 'gray',
        strokeWidth: 2
    }),
    $(go.Shape, {
        stroke: 'gray',
        fill: 'gray',
        toArrow: 'Standard'
    })
);


var nfGraph = {
    // graphQueues: [],
    // processQueue: [],
    // linkQueue: [],
    // dataQueue: []
    componentsQueue: []
};

var myModel = {
    "class": "go.GraphLinksModel",
    "nodeCategoryProperty": "type",
    "linkFromPortIdProperty": "frompid",
    "linkToPortIdProperty": "topid",
    "nodeDataArray": [],
    "linkDataArray": []
};

var mapProcessToNodeData = function(process, processName) {
    nfGraph.componentsQueue.push(process.component);
    myModel.nodeDataArray.push({
        key: processName,
        type: process.component,
        name: processName
    });
};

var mapConnectionToLinkData = function(connection) {
    if (connection.data) {
        var dataKey = myModel.linkDataArray.length;
        myModel.nodeDataArray.push({
            key: dataKey,
            type: 'Data',
            name: connection.data
        });
        connection.src = {
            process: dataKey
        };
    }
    myModel.linkDataArray.push({
        from: connection.src.process,
        frompid: connection.src.port,
        to: connection.tgt.process,
        topid: connection.tgt.port
    });
};


Promise.resolve('server/ShowContent3')
    .then(getGraph)
    .then(function function_name(myGraph) {
        _.assign(nfGraph, myGraph);
        _.each(nfGraph.processes, mapProcessToNodeData);
        _.each(nfGraph.connections, mapConnectionToLinkData);
        return nfGraph.componentsQueue;
    })
    .map(makeComponentTemplate)
    .then(function() {
        myDiagram.model = go.Model.fromJson(myModel);
    })
    .catch(function(err) {
        if (err) {
            console.warn(err);
            throw err;
        }
    });
