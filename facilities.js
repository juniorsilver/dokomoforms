var facilityTree = function(nlat, wlng, slat, elng, countThresh, distThresh) {

    var facilityNode = function(nlat, wlng, slat, elng) {
        
        this.nlat = nlat;
        this.wlng = wlng;
        this.slat = slat;
        this.elng = elng;
        this.count = 0;// revisit query
        this.center = {lat: (slat + nlat)/2.0, lng: (elng + wlng)/2.0};
        this.latSep = Math.abs(this.center.lat - nlat);
        this.lngSep = Math.abs(this.center.lng - wlng);
    
        // Children
        this.nw = null;
        this.ne = null;
        this.sw = null;
        this.se = null;
    
        //XXX TEMP DATA WILL BE STORATED IN LOCALSTORAGE
        this.hasData = false;
    
        // Begin callback chain for initialization
        if (this.latSep > distThresh || this.lngSep > distThresh)
            this.getCountAndBuild();
        else
            this.getData();
    };
    
    facilityNode.prototype.print = function(indent) {
        var indent = indent || "";
        var shift = "--";
    
        console.log(indent + " Node: " + this.center.lat, this.center.lng, this.count);
        if (this.nw && this.nw.count) { 
            console.log(indent + shift + " NW");
            this.nw.print(indent + shift)
        }
    
        if (this.ne && this.ne.count) { 
            console.log(indent + shift + " NE");
            this.ne.print(indent + shift)
        }
    
        if (this.sw && this.sw.count) { 
            console.log(indent + shift + " SW");
            this.sw.print(indent + shift)
        }
    
        if (this.se && this.se.count)  {
            console.log(indent + shift + " SE");
            this.se.print(indent + shift)
        }
    
        console.log(indent + "__");
    };
    
    facilityNode.prototype.getCountAndBuild = function() {
        var self = this;;
    
        // Revisit ajax req
        $.ajax({
            url: "http://staging.revisit.global/api/v0/facilities.json",
            data: {
                within: self.nlat + "," + self.wlng + "," + self.slat + "," + self.elng,
                limit: 'off',
                fields: "poop", //SILIENCE
            },
            success: function(data) {
                self.count = data.total;
                self.buildChildren();
            },
            error: function(data) {
            },
        });
    }
    
    facilityNode.prototype.getData = function() {
        var self = this;;
    
        // Revisit ajax req
        $.ajax({
            url: "http://staging.revisit.global/api/v0/facilities.json",
            data: {
                within: self.nlat + "," + self.wlng + "," + self.slat + "," + self.elng,
                limit: 'off',
                fields: "name,uuid,coordinates,properties:sector", 
            },
            success: function(data) {
                self.count = data.total;
                if (self.count > 0) {
                    self.data = data.facilities;
                    self.hasData = true;
                }
                console.log("Done");
            },
            error: function(data) {
            },
        });
    }
    
    facilityNode.prototype.buildChildren = function() {
        var self = this;
        if (self.count > countThresh) {
            self.nw = new facilityNode(self.nlat, self.wlng, self.center.lat, self.center.lng);
            self.ne = new facilityNode(self.nlat, self.center.lng, self.center.lat, self.elng);
            self.sw = new facilityNode(self.center.lat, self.wlng, self.slat, self.center.lng);
            self.se = new facilityNode(self.center.lat, self.center.lng, self.slat, self.elng);
        } else {
            self.getData();
        } 
    }

    facilityNode.prototype.within = function(lat, lng) {
        var self = this;
        return (lat < self.nlat && lat >= self.slat && lng > self.wlng && lng <= self.elng);
    }

    facilityNode.prototype.distance = function(lat, lng) {
        var self = this;
        var R = 6371000; // metres
        var e = self.center.lat * Math.PI/180;
        var f = lat * Math.PI/180;
        var g = (lat - self.center.lat) * Math.PI/180;
        var h = (lng - self.center.lng) * Math.PI/180;

        var a = Math.sin(g/2) * Math.sin(g/2) +
                Math.cos(e) * Math.cos(f) *
                Math.sin(h/2) * Math.sin(h/2);

        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    this.countThresh = countThresh;
    this.distThresh = distThresh;
    this.root = new facilityNode(nlat, wlng, slat, elng); 
}

//XXX: Check nearby latlngs as well, use n
facilityTree.prototype._getNNNodes = function(lat, lng, n, node) {
    var self = this;

    // Maybe I'm a leaf?
    if (node.hasData) { 
        return [node]
    }

    var nodes = [];
    if (node.count > 0) {
        // NW
        if (node.nw && node.nw.within(lat, lng)) {
            nodes = nodes.concat(self._getNNNodes(lat, lng, n, node.nw));
            if (nodes.length >= n)  {
                return nodes;
            }
        }

        // NE
        if (node.ne && node.ne.within(lat, lng)) {
            nodes = nodes.concat(self._getNNNodes(lat, lng, n, node.ne));
            if (nodes.length >= n) {
                return nodes;
            }
        }

        // SW
        if (node.sw && node.sw.within(lat, lng)) {
            nodes = nodes.concat(self._getNNNodes(lat, lng, n, node.sw));
            if (nodes.length >= n) {
                return nodes;
            }
        }

        // SE
        if (node.se && node.se.within(lat, lng)) {
            nodes = nodes.concat(self._getNNNodes(lat, lng, n, node.se));
            if (nodes.length >= n) {
                return nodes;
            }
        }
    }

    return nodes;
}

facilityTree.prototype.getNNNodes = function(lat, lng, n) {
    var self = this;
    var n = n || 1;

    if (!self.root.within(lat, lng))
        return null;

    var nodes = self._getNNNodes(lat, lng, n, self.root);
    nodes.forEach(function(node, idx) {
        console.log('node:', idx, "distance from center", node.distance(lat,lng));
    });

    return nodes;
}

facilityTree.prototype.print = function() {
    this.root.print();
}

facilityTree.prototype._getLeaves = function(node) {
    var self = this;

    // Check if this is a leaf
    if (node.hasData) 
        return [node];

    // Otherwise check all children
   
    var nodes = [];
    if (node.count > 0) {
        // NW
        if (node.nw) 
            nodes = nodes.concat(self._getLeaves(node.nw));

        // NE
        if (node.ne) 
            nodes = nodes.concat(self._getLeaves(node.ne));

        // SW
        if (node.sw) 
            nodes = nodes.concat(self._getLeaves(node.sw));

        // SE
        if (node.se) 
            nodes = nodes.concat(self._getLeaves(node.se));
    }


    return nodes;
}

facilityTree.prototype.getLeaves = function() {
    var self = this;
    var leaves = self._getLeaves(self.root);;
    return leaves;
}

console.log("Loaded");
var tree = new facilityTree(90, -180, 0, 0, 50, 0);

window.tree;
