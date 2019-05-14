/*
This demo visualises immune systems.
*/

$(function(){

  var layoutPadding = 50;
  var aniDur = 500;
  var easing = 'linear';

  var cy;

  // get exported json from cytoscape desktop via ajax
  var graphP = $.ajax({
    url: './networks.json',
    type: 'GET',
    dataType: 'json'
  });

  // also get style via ajax
  var styleP = $.ajax({
    url: './style.cycss',
    type: 'GET',
    dataType: 'text'
  });

  // templating for top left information
  var infoTemplate = Handlebars.compile([
    '<p class="ac-name">{{name}}</p>',
    '<p class="ac-node-type">Type: {{Node_Type}} </p>',
    '<p class="ac-node-suid">SUID: {{SUID}}</p> ',
    '<p class="ac-node-subtype ">Subtype: {{Node_Subtype}} </p>',
    '<p class="ac-node-crossref"> <a href={{Node_CrossRef}}> Cross Reference</a> </p>'
  ].join(''));

  // when both graph export json and style loaded, init cy
  Promise.all([ graphP, styleP ]).then(initCy);

  var allNodes = null;
  var allEles = null;
  var allEdges = null;
  var lastHighlighted = null;
  var lastUnhighlighted = null;
  var showOutgoers = true;
  var showIncomers = true;

  var selectedNodes;
  var new_network_nodes;
  function getFadePromise( ele, opacity ){
    return ele.animation({
      style: { 'opacity': opacity },
      duration: aniDur
    }).play().promise();
  };

  var restoreElesPositions = function( nhood ){
    return Promise.all( nhood.map(function( ele ){
      var p = ele.data('orgPos');

      return ele.animation({
        position: { x: p.x, y: p.y },
        duration: aniDur,
        easing: easing
      }).play().promise();
    }) );
  };

  function select_for_new_network( node ) {
    // color the node
    node.addClass('colorRed');
    console.log(node.data)
    var table = $('#selection_table').DataTable();
    console.log(table.table().header())
    var id = node.data('id');
    var shared_name = node.data('shared_name');
    var node_type = node.data('Node_Type');
    var name = node.data('name');
    var SUID =  node.data('SUID');
    var node_subtype = node.data('Node_Subtype');
    var crossref = node.data('Node_CrossRef');
    var immuneprocesses = node.data('ImmuneProcesses');
    table.row.add(
       [
         id ? id : 'N/A',
         shared_name ? shared_name : 'N/A',
         node_type ? node_type : 'N/A',
         name ? name : 'N/A',
         SUID ? SUID : 'N/A',
         node_subtype ? node_subtype : 'N/A',
         crossref ? crossref : 'N/A',
         immuneprocesses ? immuneprocesses : 'N/A'
       ]
    ).draw();
   


    // push it to the selected nodes
    // new_network_nodes = new_network_nodes.union(node.closedNeighborhood());
    selectedNodes = selectedNodes.union(node);

  }

  function remove_from_new_network(node) {
    node.removeClass('colorRed');
    // new_network_nodes = new_network_nodes.difference(node.closedNeighborhood());
    selectedNodes = selectedNodes.difference(node);
  }
  function highlight( node ){

    var nhood = lastHighlighted = node.closedNeighborhood();

    var others = lastUnhighlighted = cy.elements().not( nhood );

    var reset = function(){
      cy.batch(function(){
        others.addClass('hidden');
        nhood.removeClass('hidden');

        allEles.removeClass('faded highlighted');

        nhood.addClass('highlighted');

        others.nodes().forEach(function(n){
          var p = n.data('orgPos');

          n.position({ x: p.x, y: p.y });
        });
      });

      return Promise.resolve().then(function(){
        if( isDirty() ){
          return fit();
        } else {
          return Promise.resolve();
        };
      }).then(function(){
        return Promise.delay( aniDur );
      });
    };

    var runLayout = function(){
      var p = node.data('orgPos');

      var l = nhood.filter(':visible').makeLayout({
        name: 'preset',
        fit: false,
        animate: true,
        animationDuration: aniDur,
        animationEasing: easing,
        boundingBox: {
          x1: p.x - 1,
          x2: p.x + 1,
          y1: p.y - 1,
          y2: p.y + 1
        },
        avoidOverlap: true,
        levelWidth: function(){ return 1; },
        padding: layoutPadding
      });

      var promise = cy.promiseOn('layoutstop');

      l.run();

      return promise;
    };

    var fit = function(){
      return cy.animation({
        fit: {
          eles: nhood.filter(':visible'),
          padding: layoutPadding
        },
        easing: easing,
        duration: aniDur
      }).play().promise();
    };

    var showOthersFaded = function(){
      return Promise.delay( 250 ).then(function(){
        cy.batch(function(){
          others.removeClass('hidden').addClass('faded');
        });
      });
    };

    return Promise.resolve()
      .then( reset )
      .then( runLayout )
      .then( fit )
      .then( showOthersFaded )
    ;

  }

  function isDirty(){
    return lastHighlighted != null;
  }

  function clear( opts ){
    if( !isDirty() ){ return Promise.resolve(); }

    opts = $.extend({

    }, opts);

    cy.stop();
    allNodes.stop();

    var nhood = lastHighlighted;
    var others = lastUnhighlighted;

    lastHighlighted = lastUnhighlighted = null;

    var hideOthers = function(){
      return Promise.delay( 125 ).then(function(){
        others.addClass('hidden');

        return Promise.delay( 125 );
      });
    };

    var showOthers = function(){
      cy.batch(function(){
        allEles.removeClass('hidden').removeClass('faded');
      });

      return Promise.delay( aniDur );
    };

    var restorePositions = function(){
      cy.batch(function(){
        others.nodes().forEach(function( n ){
          var p = n.data('orgPos');

          n.position({ x: p.x, y: p.y });
        });
      });

      return restoreElesPositions( nhood.nodes() );
    };

    var resetHighlight = function(){
      nhood.removeClass('highlighted');
    };

    return Promise.resolve()
      .then( resetHighlight )
      .then( hideOthers )
      .then( restorePositions )
      .then( showOthers )
    ;
  }

  function showNodeInfo( node ){
    $('#info').html( infoTemplate( node.data() ) ).show();
  }

  function hideNodeInfo(){
    $('#info').hide();
  }

  function initCy( then ){
    var loading = document.getElementById('loading');
    var expJson = then[0];
    var styleJson = then[1];
    var elements = expJson.elements;

    elements.nodes.forEach(function(n){
      var data = n.data;

      data.NodeTypeFormatted = data.Node_Type;

      n.data.orgPos = {
        x: n.position.x,
        y: n.position.y
      };
    });

    loading.classList.add('loaded');

    cy = window.cy = cytoscape({
      container: document.getElementById('cy'),
      layout: { name: 'preset', padding: layoutPadding },
      style: styleJson,
      elements: elements,
      motionBlur: true,
      selectionType: 'single',
      boxSelectionEnabled: false,
      autoungrabify: true
    });
    new_network_nodes = cy.collection();
    selectedNodes = cy.collection();
    allNodes = cy.nodes();
    allEles = cy.elements();
    allEdges = cy.edges();

    cy.on('free', 'node', function( e ){
      var n = e.cyTarget;
      var p = n.position();

      n.data('orgPos', {
        x: p.x,
        y: p.y
      });
    });

    cy.on('tap', function(){
      $('#search').blur();
    });

    cy.on('click unselect', 'node', _.debounce( function(e){
      var node = cy.$('node:selected');
      if( node.nonempty() ){
        showNodeInfo( node );
        if (selectedNodes.contains(node)) {
          Promise.resolve().then(function(){
            return remove_from_new_network( node );
          });
        } else {
          Promise.resolve().then(function(){
            return select_for_new_network( node );
          });
        }

      } else {
        hideNodeInfo();
        clear();
      }

    }, 100 ) );

  }

  var lastSearch = '';

  $('#search').typeahead({
    minLength: 0,
    highlight: true,
  },
  {
    name: 'search-dataset',
    source: function( query, cb ){
      function matches( str, q ){
        str = (str || '').toLowerCase();
        q = (q || '').toLowerCase();
        if (q == '') {
          return false;
        }
        return str.match( q );
      }

      var fields = ['name', 'Node_Type' , 'shared_name'];

      function anyFieldMatches( n ){
        for( var i = 0; i < fields.length; i++ ){
          var f = fields[i];
          if( matches( n.data(f), query ) ){
            n.addClass('colorRed');
            n.addClass('selected');
            return true;
          } else {
            n.removeClass('colorRed');
            n.removeClass('selected');
          }
        }

        return false;
      }

      function getData(n){
        var data = n.data();

        return data;
      }

      function sortByName(n1, n2){
        if( n1.data('name') < n2.data('name') ){
          return -1;
        } else if( n1.data('name') > n2.data('name') ){
          return 1;
        }

        return 0;
      }

      var res = allNodes.stdFilter( anyFieldMatches ).sort( sortByName ).map( getData );

      cb( res );
    },
    templates: {
      suggestion: infoTemplate
    }
  }).on('typeahead:selected', function(e, entry, dataset){
    var n = cy.getElementById(entry.id);

    cy.batch(function(){
      allNodes.unselect();

      n.select();
    });

    showNodeInfo( n );
  }).on('keydown keypress keyup change', _.debounce(function(e){
    var thisSearch = $('#search').val();

    if( thisSearch !== lastSearch ){
      $('.tt-dropdown-menu').scrollTop(0);

      lastSearch = thisSearch;
    }
  }, 50));

  $('#reset').on('click', function(){
    // if( isDirty() ){
    //   clear();
    // } else {
    //   allNodes.unselect();

    //   hideNodeInfo();

    //   cy.stop();

    //   cy.animation({
    //     fit: {
    //       eles: cy.elements(),
    //       padding: layoutPadding
    //     },
    //     duration: aniDur,
    //     easing: easing
    //   }).play();
    // }
    location.reload()
  });

  $("#toggle_outgoing").on('click', function () {
    var nhood = selectedNodes;
    cy.batch(function(){
          var outgoing_edges = nhood.outgoers(function(e) {
              return (e.isEdge());
          });
          if (showOutgoers) {
              outgoing_edges.addClass('hidden');
          } else {
              outgoing_edges.removeClass('hidden');
          }
          showOutgoers = !showOutgoers;
    });
  });

  $("#toggle_incoming").on('click', function () {
    var nhood = selectedNodes;
    cy.batch(function(){
          var incoming_edges = nhood.incomers(function(e) {
              return (e.isEdge());
          });
          if (showIncomers) {
              incoming_edges.addClass('hidden');
          } else {
              incoming_edges.removeClass('hidden');
          }
          showIncomers = !showIncomers;
    });
  });

  $("#new_network_from_selec").on('click', function () {
    hideNodeInfo();
    new_network_nodes = selectedNodes.closedNeighborhood();
    console.log(new_network_nodes);
    var nhood = new_network_nodes;
    var others = cy.elements().not( nhood );
    var reset = function(){
      cy.batch(function(){
        others.addClass('hidden');
        nhood.removeClass('hidden');
        $('tbody').innerHTML('');

        allEles.removeClass('faded highlighted');

        nhood.addClass('highlighted');

        others.nodes().forEach(function(n){
          var p = n.data('orgPos');

          n.position({ x: p.x, y: p.y });
        });
      });

      return Promise.resolve().then(function(){
        if( isDirty() ){
          return fit();
        } else {
          return Promise.resolve();
        };
      }).then(function(){
        return Promise.delay( aniDur );
      });
    };

    var runLayout = function(){

      var p = new_network_nodes[0].data('orgPos');

      var l = nhood.filter(':visible').makeLayout({
        name: 'preset',
        fit: false,
        animate: true,
        animationDuration: aniDur,
        animationEasing: easing,
        boundingBox: {
          x1: p.x - 1,
          x2: p.x + 1,
          y1: p.y - 1,
          y2: p.y + 1
        },
        avoidOverlap: true,
        levelWidth: function(){ return 1; },
        padding: layoutPadding
      });

      var promise = cy.promiseOn('layoutstop');

      l.run();

      return promise;
    };

    var fit = function(){
      return cy.animation({
        fit: {
          eles: nhood.filter(':visible'),
          padding: layoutPadding
        },
        easing: easing,
        duration: aniDur
      }).play().promise();
    };

    var showOthersFaded = function(){
      return Promise.delay( 250 ).then(function(){
        cy.batch(function(){
          others.removeClass('hidden').addClass('faded');
        });
      });
    };

    return Promise.resolve()
      .then( reset )
      .then( runLayout )
      .then( fit )
      .then( showOthersFaded )
    ;


  });

  $('#filters').on('click', 'input', function(){

    // Cell Types
    var cell = $('#cell').is(':checked');
    var somatic = $('#somatic').is(':checked');
    var lymphocyte = $('#lymphocyte').is(':checked');
    var myeloid = $('#myeloid').is(':checked');
    var precursor = $('#precursor').is(':checked');
    var apc = $('#apc').is(':checked');
    var blood = $('#blood').is(':checked');

    // Cytokine
    var cytokine = $('#cytokine').is(':checked');
    var chemokine = $('#chemokine').is(':checked');
    var csf = $('#csf').is(':checked');
    var interferons = $('#interferons').is(':checked');
    var interleukins = $('#interleukins').is(':checked');
    var tnf = $('#tnf').is(':checked');
    var gf = $('#gf').is(':checked');

    // Effector Molecules
    var effmol = $('#effmol').is(':checked');
    var complement = $('#complement').is(':checked');
    var lipmed = $('#lipmed').is(':checked');
    var toxmed = $('#toxmed').is(':checked');
    var ros = $('#ros').is(':checked');
    var antipep = $('#antipep').is(':checked');
    var app = $('#app').is(':checked');
    var cytoeffectors = $('#cytoeffectors').is(':checked');
    var metabolite = $('#metabolite').is(':checked');
    var enzymes = $('#enzymes').is(':checked');
    var vitamins = $('#vitamins').is(':checked');

    // Antigen
    var antigen = $('#antigen').is(':checked');
    var bacteria = $('#bacteria').is(':checked');
    var fungi = $('#fungi').is(':checked');
    var virus = $('#virus').is(':checked');
    var self = $('#self').is(':checked');

    // Antibody
    var antibody = $('#antibody').is(':checked');

    // Edges
    var activate = $('#activate').is(':checked');
    var differentiate = $('#differentiate').is(':checked');
    var inhibit = $('#inhibit').is(':checked');
    var kill = $('#kill').is(':checked');
    var polarize = $('#polarize').is(':checked');
    var recruit = $('#recruit').is(':checked');
    var secrete = $('#secrete').is(':checked');
    var survive = $('#survive').is(':checked');


    cy.batch(function(){

      allNodes.forEach(function( n ){
        var type = n.data('Node_Type');

        n.removeClass('filtered');

        var filter = function(){
          n.addClass('filtered');
        };

        if( type === 'Cell'){

          var cType = n.data('Node_Subtype');

          if(
            // moisture
               !cell
            || (cType === 'Somatic' && !somatic)
            || (cType === 'Lymphocyte' && !lymphocyte)
            || (cType === 'Myeloid' && !myeloid)
            || (cType === 'Precursor' && !precursor)
            || (cType === 'APC' && !apc)
            || (cType === 'Blood' && !blood)


          ){
            filter();
          }

        } else if( type === 'Cytokine'){

          var cType = n.data('Node_Subtype');
          if(
                !cytokine
            || (cType === 'Chemokine' && !chemokine)
            || (cType === 'Colony-stimulating factors' && !csf)
            || (cType === 'Interferons' && !interferons)
            || (cType === 'Interleukins' && !interleukins)
            || (cType === 'Tumor Necrosis Factors' && !tnf)
            || (cType === 'Growth Factors' && !gf)

          ){
            filter();
          }

        } else if( type === 'EffectorMolecule'){

          var cType = n.data('Node_Subtype');
          if(
            !effmol ||
            (cType === 'Complement' && !complement) ||
            (cType === 'Lipid Mediators' && !lipmed) ||
            (cType === 'Toxic Mediators' && !toxmed) ||
            (cType === 'Reactive Oxygen Species' && !ros) ||
            (cType === 'Antimicrobial Peptides' && !antipep) ||
            (cType === 'Acute Phase Proteins' && !app) ||
            (cType === 'Cytotoxic Effectors' && !cytoeffectors) ||
            (cType === 'Metabolite' && !metabolite) ||
            (cType === 'Enzymes' && !enzymes) ||
            (cType === 'Vitamins' && !vitamins)

          ){
            filter();
          }

        } else if( type === 'Antigen'){
          var cType = n.data('Node_Subtype');
          if(
            !antigen ||
            (cType === 'Bacteria' && !bacteria) ||
            (cType === 'Fungi' && !fungi) ||
            (cType === 'Virus' && !virus) ||
            (cType === 'Self' && !self)
          ) {
            filter();
          }
        } else if (type === 'Antibody') {
          if (!antibody) {
            filter();
          }
        }

      });

      allEdges.forEach(function( e ){
        var iType = e.data('interaction');

        e.removeClass('filtered');
        // e.connectedNodes()[0].removeClass('filtered');
        // e.connectedNodes()[1].removeClass('filtered');

        var filter = function(){
          e.addClass('filtered');
          // var sourceNode = e.connectedNodes()[0];
          // var targetNode = e.connectedNodes()[1];
          // console.log(sourceNode.connectedNodes());
          // if (sourceNode.isChildless() && sourceNode.isOrphan()) {
          //   sourceNode.addClass('filtered');
          // }

          // if (targetNode.isChildless() && targetNode.isOrphan()) {
          //   targetNode.addClass('filtered');
          // }
        };

        if (iType == 'Activate' && !activate) {
          filter();
        } else if (iType == 'Differentiate' && !differentiate) {
          filter();
        } else if (iType == 'Inhibit' && !inhibit) {
          filter();
        } else if (iType == 'Kill' && !kill) {
          filter();
        } else if (iType == 'Polarize' && !polarize) {
          filter();
        } else if (iType == 'Recruit' && !recruit) {
          filter();
        } else if (iType == 'Secrete' && !secrete) {
          filter();
        } else if (iType == 'Survive' && !survive) {
          filter();
        } 

      });

    });

  });

  $('#filter').qtip({
    position: {
      my: 'top center',
      at: 'bottom center',
      adjust: {
        method: 'shift'
      },
      viewport: true
    },

    show: {
      event: 'click'
    },

    hide: {
      event: 'click'
    },

    style: {
      classes: 'qtip-bootstrap qtip-filters',
      tip: {
        width: 16,
        height: 8
      }
    },

    content: $('#filters')
  });

  // $('#table').qtip({
  //   position: {
  //     my: 'top center',
  //     at: 'bottom center',
  //     adjust: {
  //       method: 'shift'
  //     },
  //     viewport: true
  //   },

  //   show: {
  //     event: 'click'
  //   },

  //   hide: {
  //     event: 'click'
  //   },

  //   style: {
  //     classes: 'qtip-bootstrap qtip-filters',
  //     tip: {
  //       width: 16,
  //       height: 8
  //     }
  //   },

  //   content: $('#table_content')
  // });

  $('#table').on('click', function () {
    $('#selection_table').DataTable();
  } );



  $('#new_network_tools').qtip({
    position: {
      my: 'top center',
      at: 'bottom center',
      adjust: {
        method: 'shift'
      },
      viewport: true
    },

    show: {
      event: 'click'
    },

    hide: {
      event: 'click'
    },

    style: {
      classes: 'qtip-bootstrap qtip-filters',
      tip: {
        width: 16,
        height: 8
      }
    },

    content: $('#new_network_options')
  });

  $('#about').qtip({
    position: {
      my: 'bottom center',
      at: 'top center',
      adjust: {
        method: 'shift'
      },
      viewport: true
    },

    show: {
      event: 'click'
    },

    hide: {
      event: 'unfocus'
    },

    style: {
      classes: 'qtip-bootstrap qtip-about',
      tip: {
        width: 16,
        height: 8
      }
    },

    content: $('#about-content')
  });
});
