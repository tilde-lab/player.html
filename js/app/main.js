/**
 * CIF renderer
 * Author: Evgeny Blokhin
 * Web: http://tilde.pro
 * Email: eb@tilde.pro
 * License: MIT
 */
var player = {};
player.loaded = false;
player.container = null;
player.stats = null;
player.camera = null;
player.scene = null;
player.renderer = null;
player.controls = null;
player.atombox = null;
player.active_overlay = "";
//player.overlay_backup = null;
player.obj3d = null;

require.config({
    baseUrl: 'js/app',
    paths: { deps: '../deps' }
});
require(['polyfills', 'chemical_elements', 'deps/three.custom', 'deps/math.custom', 'domReady'], function(polyfills, chemical_elements, th, math, domReady){

var THREE = th.THREE;

function calc_2D_pos(vector){
    var v = new THREE.Vector3( vector.x, vector.y, vector.z );
    v.project( player.camera );
    return {
        x: (v.x + 1) / 2 * window.innerWidth,
        y: (-v.y + 1) / 2 * window.innerHeight
    }
}

function remove_2D_labels(){}

function add_2D_labels(){}

function unit(vec){
    return math.divide(vec, math.norm(vec));
}

function jsobj2player(crystal){
    var pi = 3.141592653589793;
    var ab_norm = [0, 0, 1];
    var a_dir = [1, 0, 0];
    var Z = unit(ab_norm);
    var X = unit( math.subtract( a_dir, math.multiply( math.dot(a_dir, Z), Z ) ) );
    var Y = math.cross(Z, X);
    //console.log("X", X);
    //console.log("Y", Y);
    //console.log("Z", Z);
    var alpha = crystal.cell.alpha * pi/180, beta = crystal.cell.beta * pi/180, gamma = crystal.cell.gamma * pi/180;
    var a = crystal.cell.a, b = crystal.cell.b, c = crystal.cell.c;
    //console.log("alpha", alpha);
    //console.log("beta", beta);
    //console.log("gamma", gamma);
    //console.log("a", a);
    //console.log("b", b);
    //console.log("c", c);
    var va = math.multiply(a, [1, 0, 0]);
    var vb = math.multiply(b, [math.cos(gamma), math.sin(gamma), 0]);
    var cx = math.cos(beta);
    var cy = math.divide( math.subtract( math.cos(alpha), math.multiply( math.cos(beta), math.cos(gamma) ) ), math.sin(gamma) );
    var cz = math.sqrt( math.subtract( math.subtract(1, math.multiply(cx, cx)), math.multiply(cy, cy) ) );
    var vc = math.multiply(c, [cx, cy, cz]);
    //console.log("va", va);
    //console.log("vb", vb);
    //console.log("vc", vc);
    //console.log("cx", cx);
    //console.log("cy", cy);
    //console.log("cz", cz);
    var abc = [va, vb, vc];
    var t = [X, Y, Z];
    //console.log("abc", abc);
    //console.log("t", t);
    var cell = math.dotMultiply(abc, t);
    //console.log("cell", cell);
    var scpositions = [];
    var i, len = crystal.atoms.length;
    for (i = 0; i < len; i++){
        scpositions.push([ crystal.atoms[i].x, crystal.atoms[i].y, crystal.atoms[i].z ]);
    }
    var positions = math.multiply(scpositions, cell);
    //console.log("positions", positions);
    var player_output = {"atoms": [], "cell": cell, "descr": crystal.cell, "overlayed": null};
    var color, radius;
    var i, len = crystal.atoms.length;
    for (i = 0; i < len; i++){
        color = (chemical_elements.JmolColors[ crystal.atoms[i].symbol ]) ? chemical_elements.JmolColors[ crystal.atoms[i].symbol ] : '0xffff00';
        radius = (chemical_elements.AseRadii[ crystal.atoms[i].symbol ]) ? chemical_elements.AseRadii[ crystal.atoms[i].symbol ] : 0.66;
        player_output.atoms.push( {"x": positions[i][0], "y": positions[i][1], "z": positions[i][2], "c": color, "r": radius, "o": {"t": crystal.atoms[i].symbol}} )
    }
    //console.log(player_output);
    return player_output;
}

function cif2player(str){
    //var sample = '{"atoms": [{"x": "0", "y": "0", "z": "0", "c": "0x000000", "r": "1.25", "o": {"m": 42, "mm": -0.0022, "t": "Uuo"}}, {"x": "1.25", "y": "1.25", "z": "1.25", "c": "0xFF0000", "r": "1", "o": {"m": 8, "t": "O"}}], "cell": [[3, 0, 0], [0, 3, 0], [0, 0, 3]], "descr": {"a": 3.00, "b": 3.00, "c": 3.00, "alpha": 90, "beta": 90, "gamma": 90}, "overlayed": {"m": "atomic ambivalence", "mm": "my test property"}}';

    var structures = [], lines = str.split("\n"), cur_structure = {'cell':{}, 'atoms':[]}, loop_active = false;
    var i=0, s=[], ss=[], new_structure=false;
    var cell_props = ['a', 'b', 'c', 'alpha', 'beta', 'gamma'];
    var atom_vals = ['_atom_site_label', '_atom_site_type_symbol', '_atom_site_fract_x', '_atom_site_fract_y', '_atom_site_fract_z'];
    var atom_props = ['label', 'symbol', 'x', 'y', 'z'];
    var atprop_seq = [];
    var i, len = lines.length;
    for (i = 0; i < len; i++){
        if (lines[i].startswith('#')) continue;
        lines[i] = lines[i].toLowerCase().trim();

        if (!lines[i]){
            loop_active = false, atprop_seq = [];
            continue;
        }
        //console.log(lines[i]);

        new_structure = false;

        if (lines[i].startswith('data_')) new_structure = true, loop_active = false, atprop_seq = [];
        else if (lines[i].startswith('_cell_')){

            loop_active = false, atprop_seq = [];
            s = lines[i].split(" ");
            ss = s[0].split("_");
            var cell_value = ss[ ss.length-1 ];
            if (cell_props.indexOf(cell_value) !== -1 && s[ s.length-1 ]){
                cur_structure.cell[cell_value] = parseFloat(s[ s.length-1 ]);
            }
            continue;

        } else if (lines[i].startswith('_symmetry_')){

            loop_active = false, atprop_seq = [];
            continue;
            // todo

        } else if (lines[i].startswith('loop_')){
            loop_active = true, atprop_seq = [];
            continue;
        }

        if (loop_active){
            if (lines[i].startswith('_')){
                atprop_seq.push(lines[i]);
            } else {
                var atom = {};
                s = lines[i].replace(/\t/g, " ").split(" ").filter(function(o){ return o ? true : false });
                var j, len2 = atprop_seq.length;
                for (j = 0; j < len2; j++){
                    var atom_index = atom_vals.indexOf(atprop_seq[j]);
                    if (atom_index !== -1 && s[j]){
                        if (['x', 'y', 'z'].indexOf(atom_props[atom_index]) !== -1) s[j] = parseFloat(s[j]);
                        else s[j] = s[j].charAt(0).toUpperCase() + s[j].slice(1);
                        atom[ atom_props[atom_index] ] = s[j];
                    }
                }
                if (atom.x !== undefined && atom.y !== undefined && atom.z !== undefined){ // NB zero coord
                    if (!atom.symbol && !!atom.label) atom.symbol = atom.label.replace(/[0-9]/g, '');
                    if (!chemical_elements.JmolColors[atom.symbol] && atom.symbol.length > 2) atom.symbol = atom.symbol.substr(0, atom.symbol.length-1);
                    if (!chemical_elements.JmolColors[atom.symbol] && atom.symbol.length > 1) atom.symbol = atom.symbol.substr(0, atom.symbol.length-1);
                    if (!!atom.symbol) cur_structure.atoms.push(atom);
                }
            }
            continue;
        }

        if (new_structure && cur_structure.atoms.length){
            structures.push(cur_structure);
            cur_structure = {'cell':{}, 'atoms':[]};
        }
    }
    if (cur_structure.atoms.length) structures.push(cur_structure);
    //console.log(structures);

    if (structures.length) return jsobj2player(structures[ structures.length-1 ]);
    else return false;
}

function draw_3d_line(start_arr, finish_arr, color){
    if (!color) var color = 0x999999;
    var vector = new THREE.Geometry();
    vector.vertices.push(new THREE.Vector3( start_arr[0], start_arr[1], start_arr[2] ));
    vector.vertices.push(new THREE.Vector3( finish_arr[0], finish_arr[1], finish_arr[2] ));
    var material = new THREE.LineBasicMaterial({color: color});
    player.atombox.add(new THREE.Line(vector, material));
}

function render_3D(){
    var old = player.scene.getObjectByName("atoms3d");
    if (!!old) player.scene.remove( old );
    player.atombox = new THREE.Object3D();

    //player.obj3d = player.obj3d || sample;
    //player.obj3d = JSON.parse(player.obj3d);

    if (player.obj3d.descr && 'a' in player.obj3d.descr){
        var descr = player.obj3d.descr;
        var test = document.getElementById('infopanel');
        if (!!test) test.parentNode.removeChild(test);
        var infopanel = document.createElement('div');
        infopanel.setAttribute('id', 'infopanel');
        infopanel.innerHTML = '<span style=color:#900>a = '+descr['a']+' &#8491;</span><br /><span style=color:#090>b = '+descr['b']+' &#8491;</span><br /><span style=color:#009>c = '+descr['c']+' &#8491;</span><br />&#945; = '+descr['alpha']+'&deg;<br />&#946; = '+descr['beta']+'&deg;<br />&#947; = '+descr['gamma']+'&deg;<br />';
        player.container.appendChild( infopanel );
    }

    var test = document.getElementById('optionpanel');
    if (!!test) { test.parentNode.removeChild(test); remove_2D_labels(); }
    var optionpanel = document.createElement('div');
    optionpanel.setAttribute('id', 'optionpanel');
    optionpanel.innerHTML = '<input type=radio name=optionpanel id=optionpanel_ checked=true /><label for=optionpanel_>none</label>';
    optionpanel.innerHTML += ' <input type=radio name=optionpanel id=optionpanel_t /><label for=optionpanel_t>elements</label>';
    optionpanel.innerHTML += ' <input type=radio name=optionpanel id=optionpanel_N /><label for=optionpanel_N>id\'s</label>';
    if (player.obj3d.overlayed){
        for (var prop in player.obj3d.overlayed){
            optionpanel.innerHTML += ' <input type=radio name=optionpanel id=optionpanel_'+prop+' /><label for=optionpanel_'+prop+'>'+player.obj3d.overlayed[prop]+'</label>';
        }
    }
    player.container.appendChild( optionpanel );
    optionpanel.onclick = function(e){
        remove_2D_labels();
        if (!e) e = window.event;
        player.active_overlay = (e.target || e.srcElement).id.replace('optionpanel_', '');
        if (player.active_overlay.length) add_2D_labels();
    }

    var actd, sphd = {lodim:{w:6, h:6}, hidim:{w:10, h:8}};
    player.obj3d.atoms.length > 50 ? actd = sphd.lodim : actd = sphd.hidim;

    var i, len = player.obj3d.atoms.length;
    for (i = 0; i < len; i++){
        var atom = new THREE.Mesh( new THREE.SphereGeometry( player.obj3d.atoms[i].r*40, actd.w, actd.h ), new THREE.MeshLambertMaterial( { color: player.obj3d.atoms[i].c, shading: THREE.FlatShading, overdraw: 0.25 } ) );
        atom.position.x = parseInt( player.obj3d.atoms[i].x*100 );
        atom.position.y = parseInt( player.obj3d.atoms[i].y*100 );
        atom.position.z = parseInt( player.obj3d.atoms[i].z*100 );
        atom.name = "atom3d";
        player.atombox.add(atom);
    }
    if (player.obj3d.cell.length){
        var tempcolor, ortes = [];
        for (var i = 0; i < 3; i++){
            var a = Math.round(parseFloat(player.obj3d.cell[i][0])*1000)/10;
            var b = Math.round(parseFloat(player.obj3d.cell[i][1])*1000)/10;
            var c = Math.round(parseFloat(player.obj3d.cell[i][2])*1000)/10;
            ortes.push([a, b, c]);
            var trans_vector = new THREE.Geometry();
            trans_vector.vertices.push(new THREE.Vector3(0, 0, 0));
            trans_vector.vertices.push(new THREE.Vector3( a, b, c ));
            if (i==0) tempcolor = 0x990000;
            if (i==1) tempcolor = 0x009900;
            if (i==2) tempcolor = 0x000099;
            player.atombox.add(new THREE.Line(trans_vector, new THREE.LineBasicMaterial({color: tempcolor })));
        }

        var material = new THREE.LineBasicMaterial({color: 0xCCCCCC });
        var plane_point1 = [ortes[0][0]+ortes[1][0], ortes[0][1]+ortes[1][1], ortes[0][2]+ortes[1][2]]
        var plane_point2 = [ortes[0][0]+ortes[2][0], ortes[0][1]+ortes[2][1], ortes[0][2]+ortes[2][2]]
        var plane_point3 = [plane_point1[0]+ortes[2][0], plane_point1[1]+ortes[2][1], plane_point1[2]+ortes[2][2]]
        var dpoint = [ortes[1][0]+ortes[2][0], ortes[1][1]+ortes[2][1], ortes[1][2]+ortes[2][2]]
        var drawing_cell = [];

        drawing_cell.push([ortes[0], plane_point1]);
        drawing_cell.push([ortes[0], plane_point2]);
        drawing_cell.push([ortes[1], dpoint]);
        drawing_cell.push([ortes[1], plane_point1]);
        drawing_cell.push([ortes[2], dpoint]);
        drawing_cell.push([ortes[2], plane_point2]);
        drawing_cell.push([plane_point1, plane_point3]);
        drawing_cell.push([plane_point2, plane_point3]);
        drawing_cell.push([plane_point3, dpoint]);

        var i, len = drawing_cell.length;
        for (i = 0; i < len; i++){
            draw_3d_line(drawing_cell[i][0], drawing_cell[i][1]);
        }
    }
    player.atombox.name = "atoms3d";
    player.scene.add(player.atombox);
    //TWEEN.removeAll();
    play();
    //var fake_phonon = ''; for (var i=0; i<player.obj3d.atoms.length; i++){ fake_phonon += '1,1,1, ' } // debug phonon animation
    //vibrate_3D( '[' + fake_phonon.substr(0, fake_phonon.length-2) + ']' );
}

function init_3D(){
    player.loaded = true;

    player.container = document.createElement('div');
    player.container.style.backgroundColor = '#ffffff';
    document.body.appendChild( player.container );

    player.scene = new THREE.Scene();
    player.camera = new THREE.OrthographicCamera( -window.innerWidth*1.5, window.innerWidth*1.5, -window.innerHeight*1.5, window.innerHeight*1.5, -2000, 2000 );
    player.camera.position.set(0, 0, 1);
    player.scene.add(player.camera);

    var AmbientLight = new THREE.AmbientLight( 0x999999 );
    player.scene.add( AmbientLight );
    var PointLight = new THREE.PointLight( 0x666666, 1 );
    //PointLight.position = player.camera.position;
    PointLight.position.set(500, 500, 500);
    player.scene.add( PointLight );

    player.renderer = new THREE.CanvasRenderer();
    player.renderer.setClearColor( 0xffffff, 1 );
    player.renderer.setSize( window.innerWidth, window.innerHeight );
    player.container.appendChild( player.renderer.domElement );

    //player.stats = new Stats();
    //player.stats.domElement.style.position = 'absolute';
    //player.stats.domElement.style.top = '0px';
    //player.container.appendChild( player.stats.domElement );

    var zoompanel = document.createElement('div');
    zoompanel.setAttribute('id', 'zoompanel');
    player.container.appendChild( zoompanel );
    zoompanel.onclick = function(e){
        if (!e) e = window.event;
        if (e.cancelBubble) e.cancelBubble = true;
        else e.stopPropagation();

        var y = (e.pageY) ? e.pageY : e.clientY;
        if (y<44){
            /*var uri = document.location.hash.substr(1).split('/');
            if (uri.length == 2){
                if (!!window.parent._gui) window.open('/static/#' + uri[0] + '/' + uri[1]);
                else self.close();
            }*/
            return;
        }
        var fov = ((y > 99) ? -1 : 1) * 333, c = window.innerHeight/window.innerWidth;
        player.camera.left += fov;
        player.camera.right -= fov;
        player.camera.top += fov*c;
        player.camera.bottom -= fov*c;
        player.camera.updateProjectionMatrix();
        remove_2D_labels();
        add_2D_labels();
        play();
    }

    player.controls = new THREE.OrthographicTrackballControls( player.camera );
    render_3D();
}

function play(){
    //if (!!window.active_renderer) requestAnimationFrame(play);
    requestAnimationFrame(play);
    player.renderer.render(player.scene, player.camera);
    player.controls.update();
    //TWEEN.update();
    //player.stats.update();
}

function url_redraw_react(){
    var t = document.location.hash.substr(1);
    file_download(t);
}

/*function iframe_download( request, scope, hash ){
    var dl = document.createElement( 'form' );
    dl.method = "GET";
    dl.action = '/' + request + '/' + scope + '/' + hash;
    dl.target = "file-process";
    dl.style.display = "none";
    document.body.appendChild(dl);
    dl.submit();
}*/

function file_download(url){
    if (url.indexOf('://') == -1) return;
    var parser = document.createElement('a');
    parser.href = url;
    if (parser.hostname !== window.location.hostname){
        url = 'proxy.php?url=' + url;
    }

    var xmlhttp = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
    xmlhttp.onreadystatechange = function(){
        if (xmlhttp.readyState == 4){
            if (xmlhttp.status == 200){
                player.obj3d = xmlhttp.responseText || "";
                accept_data();
            } else alert("Error: HTTP " + xmlhttp.status + " status received during retrieving data from the server");
        }
    }
    xmlhttp.open("GET", url);
    xmlhttp.setRequestHeader("If-Modified-Since", "Sat, 1 Jan 2000 00:00:00 GMT");
    xmlhttp.send(1);
}

function accept_data(){
    //console.log("Contents follow:", player.obj3d);

    if (player.obj3d.indexOf("_cell_angle_gamma ") > -1){
        player.obj3d = cif2player(player.obj3d);
        if (!player.obj3d) return alert("Error: the file has invalid format!");
    } else {
        return alert("Error: the file format is not supported!");
    }

    player.loaded ? render_3D() : init_3D();
}

function handleFileSelect(evt){
    evt.stopPropagation();
    evt.preventDefault();

    if (evt.dataTransfer.files.length > 1) return alert("Error: only one file at the time may be rendered!");
    var file = evt.dataTransfer.files[0];
    if (!file || !file.size) return alert("Error: file cannot be read (unaccessible?)");

    var reader = new FileReader();

    reader.onloadend = function(evt){
        player.obj3d = evt.target.result;
        accept_data();
    }
    reader.abort = function(){ alert("Error: file reading has been cancelled!") }
    reader.onerror = function(evt){ alert("Error: file reading has been cancelled: " + evt.target.error.name) }

    reader.readAsText(file);
}

function handleDragOver(evt){
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy';
}

domReady(function(){
    if (!window.location.protocol.startswith('http')){
        return alert('Error: this page must be served by a PHP- or Python-enabled web server');
    }

    //window.addEventListener('DOMMouseScroll', rescale, false);
    //window.addEventListener('mousewheel', rescale, false);
    window.addEventListener('hashchange', url_redraw_react, false);
    if (window.FileReader){
        window.addEventListener('dragover', handleDragOver, false);
        window.addEventListener('drop', handleFileSelect, false);
    }
    window.addEventListener('mousedown', function(){ console.log(player.controls._state) }, false);
    window.addEventListener('touchmove', function(){ console.log(player.controls._state) }, false);

    if (document.location.hash.length) url_redraw_react();
    //else document.location.hash = '#http://www.rsc.org/suppdata/nj/b6/b617452n/b617452n.txt';
    else file_download(window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + '/Ag.cif');
});

});
