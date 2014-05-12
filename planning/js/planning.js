var rm_chart;

/* DateInterval class definition */
function DateInterval(ms) { this.ms = ms; };
DateInterval.prototype.seconds = function () { return this.ms / 1000; };
DateInterval.prototype.minutes = function () { return this.ms / 60000; };
DateInterval.prototype.hours = function () { return this.ms / 3600000; };
DateInterval.prototype.days = function () { return this.ms / 86400000; };

/* Inject DateInterval into Date class */
Date.prototype.subtract = function (other) { return new DateInterval(this - other); };
Date.prototype.add = function (interval) { var r = new Date(); r.setTime(this.getTime() + interval.ms); return r;};
Date.prototype.toISODateString = function () { return this.getFullYear() + "-" + (this.getMonth() + 1) + "-" + this.getDate(); };

function getToday()
{
    var today = new Date();
    today.setUTCHours(0);
    today.setUTCMinutes(0);
    today.setUTCSeconds(0);
    today.setDate(today.getDate() - 15);
    return today;
}

function showTooltip(issue)
{
    var $ = jQuery;

    $('.planning-tooltip').remove();

    var d = $('<div></div>');
    var bb = issue.element.getBBox();
    var s = issue.chart.getScale();
    var pos = $('#' + issue.chart.options.target).position();
    var x = s[0] * (bb.x - issue.chart.viewbox.x) + pos.left;
    var y = s[1] * (bb.y - issue.chart.viewbox.y + issue.chart.options.issue_height + issue.chart.options.spacing[1]) + pos.top;
    d.addClass('planning-tooltip')
    .css({
        'position': 'absolute',
        'left': x,
        'top': y,
        'border': 'thin solid #444',
        'background-color': '#fff',
        'padding': '5',
        'max-width': '200'
    });
    d.html(
        '<p><strong>Issue #' + issue.id + ': ' + issue.name + '</strong></p>' +
        '<p><strong>Start date:</strong> ' + issue.chart.formatDate(issue.start_date) + '</p>' + 
        '<p><strong>Due date:</strong> ' + issue.chart.formatDate(issue.due_date) + '</p>' + 
        '<p><strong>Description:</strong> ' + issue.description + '</p>'
    );

    $('body').append(d);
}

/* Chart class definition */
function PlanningChart(options)
{
    var defaults = {
        target: 'redmine_planning_chart',
        issue_height: 20,
        zoom_level: 1,
        margin: [10, 20],
        spacing: [10, 10],
        issue_fill_color: '#cccccc',
        issue_stroke_color: '#800000',
        issue_stroke_width: 2,
        issue_border_radius: 2,
        issue_resize_border: 3,
        date_format: 'd/m'
    };

    if (!options)
        options = {};

    this.options = jQuery.extend(options, defaults);

    if (this.options['target'].substr(0, 1) == '#')
        this.options['target'] = this.options['target'].substr(1);

    this.issues = {'length': 0};
    this.relations = {'length': 0};
    this.dirty = {};
    this.base_date = getToday();
    this.paper = Raphael(this.options['target']);
    this.container = $('#' + this.options['target']);
    this.viewbox = {'x': 0, 'y': 0, 'w': this.container.innerWidth(), 'h': this.container.innerHeight()};
    
    // Add background to enable panning
    this.bg = this.paper.rect(-10000, -10000, 20000, 20000, 5); 
    this.bg.attr('fill', '#ffffff');
    this.bg.toBack();

    var chart = this;

    this.bg.drag(function (dx, dy) {
        chart.viewbox.x = chart.viewbox.sx - dx;
        chart.viewbox.y = chart.viewbox.sy - dy;
        if (chart.viewbox.x < 0)
            chart.viewbox.x = 0;
        if (chart.viewbox.x > chart.container.width() - chart.viewbox.w)
            chart.viewbox.x = chart.container.width() - chart.viewbox.w;
        if (chart.viewbox.y < 0)
            chart.viewbox.y = 0;
        if (chart.viewbox.y > chart.container.height() - chart.viewbox.h)
            chart.viewbox.y = chart.container.height() - chart.viewbox.h;
        chart.paper.setViewBox(chart.viewbox.x, chart.viewbox.y, chart.viewbox.w, chart.viewbox.h);
    }, function () {
        chart.viewbox.sx = chart.viewbox.x;
        chart.viewbox.sy = chart.viewbox.y;
    });
    this.container.on('mousewheel', function (e) {
        var zoom = rm_chart.options.zoom_level;
        if (e.deltaY > 0)
        {
            if (++zoom > 4)
                zoom = 4;
        }
        else if (e.deltaY < 0)
        {
            if (--zoom < 1)
                zoom = 1;
        }
        rm_chart.options.zoom_level = zoom;

        rm_chart.viewbox.w = Math.round(rm_chart.container.width() / zoom);
        rm_chart.viewbox.h = Math.round(rm_chart.container.height() / zoom);

        if (rm_chart.viewbox.x < 0)
            rm_chart.viewbox.x = 0;
        if (rm_chart.viewbox.x > rm_chart.container.width() - rm_chart.viewbox.w)
            rm_chart.viewbox.x = rm_chart.container.width() - rm_chart.viewbox.w;
        if (rm_chart.viewbox.y < 0)
            rm_chart.viewbox.y = 0;
        if (rm_chart.viewbox.y > rm_chart.container.height() - rm_chart.viewbox.h)
            rm_chart.viewbox.y = rm_chart.container.height() - rm_chart.viewbox.h;

        rm_chart.paper.setViewBox(rm_chart.viewbox.x, rm_chart.viewbox.y, rm_chart.viewbox.w, rm_chart.viewbox.h);
    });
}

PlanningChart.prototype.dayWidth = function()
{
    return 20;
    //switch (this.options['zoom_level'])
    //{
    //    case 1:
    //        return 5;
    //    case 2:
    //        return 10;
    //    case 4:
    //        return 40;
    //    case 3:
    //    default:
    //        return 20;
    //}
};

PlanningChart.prototype.formatDate = function(date)
{
    var d = date.getDate();
    var m = date.getMonth() + 1;
    var y = date.getYear();
    var yy = date.getFullYear();
    switch (this.options.date_format)
    {
        case "d-m-Y":
            return d + "-" + m + "-" + yy;
        case "d-m-y":
            return d + "-" + m + "-" + y;
        case "d-m":
            return d + "-" + m;
        case "d/m/Y":
            return d + "/" + m + "/" + yy;
        case "d/m/y":
            return d + "/" + m + "/" + y;
        case "d/m":
            return d + "/" + m;
        case "m-d-Y":
            return m + "-" + d + "-" + yy;
        case "m-d-y":
            return m + "-" + d + "-" + y;
        case "m-d":
            return m + "-" + d;
        case "m/d/Y":
            return m + "/" + d + "/" + yy;
        case "m/d/y":
            return m + "/" + d + "/" + y;
        case "m/d":
            return m + "/" + d;
        case "y/m/d":
            return y + "/" + m + "/" + d;
        case "y-m-d":
            return y + "-" + m + "-" + d;
        case "Y/m/d":
            return yy + "/" + m + "/" + d;
        case "Y-m-d":
            return yy + "-" + m + "-" + d;
    }
}


PlanningChart.prototype.addIssue = function(issue)
{
    issue.setChart(this, this.issues.length++);
    this.issues[issue.id] = issue;
};

PlanningChart.prototype.removeIssue = function(id)
{
    if (this.issues[id])
    {
        if (this.issues[id].element)
            this.issues[id].element.remove();
        delete this.issues[id];
    }
}

PlanningChart.prototype.addRelation = function(relation)
{
    relation.setChart(this, this.relations.length++);
    this.relations[relation.id] = relation;
};

PlanningChart.prototype.removeRelation = function(id)
{
    if (this.relations[id])
    {
        if (this.relations[id].element)
            this.relations[id].element.remove();
        delete this.relations[id];
    }
}

PlanningChart.prototype.reset = function()
{
    this.paper.clear();
    for (var k in this.issues)
        this.issues[k]['issue'] = null;
    for (var k in this.relations)
        this.relations[k]['issue'] = null;
};

PlanningChart.prototype.drawHeader = function()
{
    if (this.header)
    {
        this.header.remove();
        this.header = null;
    }

    var base = this.base_date;
    var dw = this.dayWidth();

    this.paper.setStart();

    for (var w = 0; w < 90; w += 2)
    {
        var cur = new Date();
        cur.setTime(base.getTime() + w * 86400000);

        var days = cur.subtract(base).days();
        var x = this.options.margin[0] + days * dw;
        var y = 0;

        this.paper.path("M" + x + "," + y + "L" + x + "," + (y + 5));
        if (w % 4 == 0)
        {
            var t = this.paper.text(x + 2, y + 10, this.formatDate(cur));
        }
    }

    this.header = this.paper.setFinish().attr({
        'stroke': '#00f',
        'font-size': 10,
        'font-weight': 100
    });
};

PlanningChart.prototype.draw = function(redraw)
{
    this.drawHeader();
    for (var k in this.issues)
    {
        if (k == "length")
            continue;
        this.issues[k].update();
    }

    for (var k in this.relations)
    {
        if (k == "length")
            continue;
        this.relations[k].draw();
    }
};

PlanningChart.prototype.getScale = function()
{
    return [
        this.container.width() / this.viewbox.w,
        this.container.height() / this.viewbox.h
    ];
};

PlanningChart.prototype.clientToCanvas = function(x, y)
{
    var s = this.getScale();
    var cx = x / s[0] + this.viewbox.x;
    var cy = y / s[1] + this.viewbox.y;

    return [cx, cy];
};

PlanningChart.prototype.analyzeHierarchy = function()
{
    // Reset and initialize all relation arrays
    for (var k in this.issues)
    {
        if (k == "length")
            continue;
        this.issues[k].relations.incoming = [];
        this.issues[k].relations.outgoing = [];
    }

    // Add all relations to the corresponding issues
    for (var k in this.relations)
    {
        if (k == "length")
            continue;
        var relation = this.relations[k];
        if (!this.issues[relation.from])
            throw ("Issue " + relation.from + " is not available");
        if (!this.issues[relation.to])
            throw ("Issue " + relation.to + " is not available");
        relation.fromIssue = this.issues[relation.from];
        relation.toIssue = this.issues[relation.to];

        if (!relation.fromIssue.relations.outgoing)
            relation.fromIssue.relations.outgoing = [];
        if (!relation.toIssue.relations.incoming)
            relation.toIssue.relations.incoming = [];

        relation.fromIssue.relations.outgoing.push(relation);
        relation.toIssue.relations.incoming.push(relation);
    }
};

PlanningChart.prototype.markDirty = function(issue)
{
    console.log("dirty: " + issue.id);
    this.dirty[issue.id] = issue;
}

PlanningChart.prototype.saveDirty = function()
{
    var store = {"issues": [], "relations": []};
    for (var id in this.dirty)
    {
        store.issues.push({
            'id': id,
            'start_date': this.dirty[id].start_date.toISODateString(),
            'due_date': this.dirty[id].due_date.toISODateString()
        });
        this.dirty[id].orig_data = null;
        this.dirty[id].orig_geometry = null;
        delete this.dirty[id].critical_path_determined;
    }
    console.log(store);
    this.dirty = {};
}

/* Issue class definition */
function PlanningIssue(data)
{
    this.start_date = new Date(data['start_date']);
    this.due_date = new Date(data['due_date']);
    this.name = data['name'];
    this.description = data['name'];
    this.project = data['project'];
    this.id = data['id'];

    this.relations = {};
    this.chart = null;
    this.element = null;
    this.geometry = null;
}

PlanningIssue.prototype.setChart = function(chart, idx)
{
    this.chart = chart;
    this.idx = idx;
};

PlanningIssue.prototype.getRelations = function()
{
    if (!this.relations.incoming || !this.relations.outgoing)
        this.chart.analyzeHierarchy();

    var list = [];
    for (var k in this.relations.incoming)
        list.push(this.relations.incoming[k]);
    for (var k in this.relations.outgoing)
        list.push(this.relations.outgoing[k]);
    return list;
};

PlanningIssue.prototype.update = function()
{
    // Recalculate geometry
    var base = this.chart.base_date;
    this.geometry = {
        x: this.chart.options.margin[0] + (this.start_date.subtract(base).days() * this.chart.dayWidth()),
        y: this.chart.options.margin[1] + this.idx * (this.chart.options.issue_height + this.chart.options.spacing[1]),
        height: this.chart.options.issue_height,
        width: this.chart.dayWidth() * this.due_date.subtract(this.start_date).days()
    };

    return this.draw();
}

PlanningIssue.prototype.backup = function()
{
    if (!this.orig_geometry)
        this.orig_geometry = jQuery.extend({}, this.geometry);
    if (!this.orig_data)
        this.orig_data = {'start_date': this.start_date, 'due_date': this.due_date};
    this.chart.markDirty(this);
};

PlanningIssue.prototype.move = function(delay, utime)
{
    this.start_date = this.start_date.add(delay);
    this.due_date = this.due_date.add(delay);
    this.backup(this);

    this.update();
    this.element.attr(this.geometry);

    // Update dependent issues
    for (var k in this.relations.outgoing)
    {
        var r = this.relations.outgoing[k];
        switch (r.type)
        {
            case "blocks":
                if (r.toIssue.due_date < this.due_date)
                {
                    var delay = this.due_date.subtract(r.toIssue.due_date);
                    r.toIssue.move(delay);
                }
                break;
            case "precedes":
                if (r.toIssue.start_date < this.due_date)
                {
                    var delay = this.due_date.subtract(r.toIssue.due_date);
                    r.toIssue.move(delay);
                }
                break;
        }
        r.draw();
    }

    for (var k in this.relations.incoming)
    {
        var r = this.relations.incoming[k];
        switch (r.type)
        {
            case "blocks":
                if (this.due_date < r.fromIssue.due_date)
                {
                    var delay = this.due_date.subtract(r.fromIssue.due_date);
                    r.fromIssue.move(delay);
                }
                break;
            case "precedes":
                if (this.start_date < r.fromIssue.due_date)
                {
                    var delay = this.start_date.subtract(r.fromIssue.due_date);
                    r.fromIssue.move(delay);
                }
                break;
        }
        r.draw();
    }
}

PlanningIssue.prototype.calculateLimits = function(direction, ctime)
{
    if (this.critical_path_time && this.critical_path_time >= ctime)
        return;

    this.critical_path_time = ctime;
    this.min_start_date = null;
    this.max_start_date = null;
    this.min_due_date = null;
    this.max_due_date = null;

    var duration = this.due_date.subtract(this.start_date);
    var minusDuration = new DateInterval(-duration.ms);

    for (var type in this.relations)
    {
        if (direction > 0 && type == "incoming")
            continue;
        if (direction < 0 && type == "outgoing")
            continue;

        for (var k in this.relations[type])
        {
            // Update min_start_date
            var r = this.relations[type][k];
            switch (r.type)
            {
                case 'relates':
                case 'copied_to':
                case 'duplicates':
                    continue;
                case 'blocks':
                    // End-to-end relation: the from-issue must end before
                    // the to-issue can end
                    if (type == "incoming")
                    {
                        r.fromIssue.calculateLimits(-1, ctime);
                        if (r.fromIssue.min_due_date !== null)
                        {
                            var own_min_start = r.fromIssue.min_due_date.add(minusDuration);
                            if (
                                this.min_start_date === null || 
                                own_min_start > this.min_start_date
                            )
                            {
                                this.min_start_date = own_min_start;
                            }
                        }
                    }
                    else
                    {
                        r.toIssue.calculateLimits(1, ctime);
                        if (
                            r.toIssue.max_due_date !== null && 
                            (
                                this.max_due_date === null || 
                                r.toIssue.max_due_date < this.max_due_date
                            )
                        )
                        {
                            this.max_due_date = r.toIssue.max_due_date;
                        }
                    }
                    break;
                case 'precedes':
                    // End-to-start relation: the from-issue must end before
                    // the to-issue can begin
                    if (type == "incoming")
                    {
                        r.fromIssue.calculateLimits(-1, ctime);
                        if (
                            r.fromIssue.min_due_date !== null && 
                            (
                                this.min_start_date === null || 
                                r.fromIssue.min_due_date > this.min_start_date
                            )
                        )
                        {
                            this.min_start_date = r.fromIssue.min_due_date;
                        }
                    }
                    else
                    {
                        r.toIssue.calculateLimits(1, ctime);
                        if (
                            r.toIssue.max_start_date !== null && 
                            (
                                this.max_due_date === null || 
                                r.toIssue.max_start_date < this.max_due_date
                            )
                        )
                        {
                            this.max_due_date = r.toIssue.max_start_date;
                        }
                    }
                    break;
            }
        }
    }

    if (direction != 0)
    {
        // If moving the endpoint is not allowed, check
        // if this is an endpoint and update accordingly
        if (!this.min_start_date)
            this.min_start_date = this.start_date;
        if (!this.max_due_date)
            this.max_due_date = this.due_date;
    }

    if (this.min_start_date)
        this.min_due_date = this.min_start_date.add(duration);
    if (this.max_due_date)
        this.max_start_date = this.max_due_date.add(minusDuration);

    if (direction == 0)
    {
        if (this.critical_lines)
            this.critical_lines.remove();

        // Show critical path lines for first element
        var min_date = this.min_start_date;
        var max_date = this.max_due_date;

        this.chart.paper.setStart();
        if (min_date !== null)
        {
            var min_x = Math.round(this.chart.options.margin[0] + (min_date.subtract(this.chart.base_date).days() * this.chart.dayWidth()));
            var path1 = "M" + min_x + ",0L" + min_x + ",1000";
            this.chart.paper.path(path1);
        }
        if (max_date !== null)
        {
            var max_x = Math.round(this.chart.options.margin[0] + (max_date.subtract(this.chart.base_date).days() * this.chart.dayWidth()));
            var path2 = "M" + max_x + ",0L" + max_x + ",1000";
            this.chart.paper.path(path2);
        }
        this.critical_lines = this.chart.paper.setFinish().attr('stroke', '#f00');
    }
};

PlanningIssue.prototype.checkConsistency = function(resize)
{
    var duration = this.due_date.subtract(this.start_date);
    var minusDuration = new DateInterval(-duration.ms);

    if (this.min_start_date !== null && this.start_date < this.min_start_date)
    {
        this.start_date = this.min_start_date;
        if (!resize)
            this.due_date = this.min_due_date;
    }
    else if (this.max_due_date !== null && this.due_date > this.max_due_date)
    {
        this.due_date = this.max_due_date;
        if (!resize)
            this.start_date = this.max_start_date;
    }

    // Recalculate geometry based on dates
    this.update();

    for (var k in this.relations.outgoing)
    {
        var r = this.relations.outgoing[k];
        switch (r.type)
        {
            case "blocks":
                if (r.toIssue.due_date < this.due_date)
                {
                    var delay = this.due_date.subtract(r.toIssue.due_date);
                    r.toIssue.move(delay);
                }
                break;
            case "precedes":
                if (r.toIssue.start_date < this.due_date)
                {
                    var delay = this.due_date.subtract(r.toIssue.start_date);
                    r.toIssue.move(delay);
                }
                break;
        }
        r.draw();
    }

    for (var k in this.relations.incoming)
    {
        var r = this.relations.incoming[k];
        switch (r.type)
        {
            case "blocks":
                if (this.due_date < r.fromIssue.due_date)
                {
                    var delay = this.due_date.subtract(r.fromIssue.due_date);
                    r.fromIssue.move(delay);
                }
                break;
            case "precedes":
                if (this.start_date < r.fromIssue.due_date)
                {
                    var delay = this.start_date.subtract(r.fromIssue.due_date);
                    r.fromIssue.move(delay);
                }
                break;
        }
        r.draw();
    }
};

function PlanningIssue_closeTooltip(e)
{
    jQuery('.planning-tooltip').remove();
}

function PlanningIssue_changeCursor(e, mouseX, mouseY)
{
    if (this.dragging)
        return;

    var x = e.offsetX ? e.offsetX : e.layerX;
    var y = e.offsetY ? e.offsetY : e.layerY;

    var conv = this.chart.clientToCanvas(x, y)
    x = conv[0];
    y = conv[1];

    var relX = x - this.element.attr('x');
    var relY = y - this.element.attr('y');

    if (relX <= this.chart.options.issue_resize_border)
        this.element.attr('cursor', 'w-resize');
    else if (relX >= this.element.attr('width') - this.chart.options.issue_resize_border)
        this.element.attr('cursor', 'e-resize');
    else
    {
        this.element.attr('cursor', 'move');
        console.log('up');
        showTooltip(this);
    }
}

function PlanningIssue_dragStart()
{
    jQuery('.planning-tooltip').remove();
    this.dragging = true;
    this.backup();
    this.getRelations();
    var ctime = new Date(); 
    this.calculateLimits(0, ctime);
}

function PlanningIssue_dragMove(dx, dy, x, y)
{
    var chart = this.chart;
    var s = this.chart.getScale();
    dx /= s[0];
    dy /= s[1];

    var cursor = this.element.attr('cursor');
    var dDays = Math.round(dx / chart.dayWidth());
    var movement = new DateInterval(dDays * 86400000);
    var plus_one_day = new DateInterval(86400000);
    var minus_one_day = new DateInterval(-86400000);
    var dWidth = dDays * this.chart.dayWidth();
    var direction = 1;

    var prev_start_date = this.start_date;
    var prev_due_date = this.due_date;
    var resize = false;
    switch (cursor)
    {
        case 'w-resize':
            var new_start = this.orig_data.start_date.add(movement);
            if (new_start >= this.due_date)
                this.start_date = this.due_date.add(minus_one_day);
            else
                this.start_date = new_start;
            resize = true;
            break;
        case 'e-resize':
            var new_due = this.orig_data.due_date.add(movement);
            if (new_due <= this.start_date)
                this.due_date = this.start_date.add(plus_one_day);
            else
                this.due_date = new_due;
            resize = true;
            break;
        case 'move':
            this.start_date = this.orig_data.start_date.add(movement);
            this.due_date = this.orig_data.due_date.add(movement);
    }

    if (resize)
    {
        // When resizing, the critical path analysis is unreliable so we need to
        // do it over after each time
        this.calculateLimits(0, new Date());
    }

    this.checkConsistency(resize);
}

function PlanningIssue_dragEnd()
{
    this.dragging = false;
    this.chart.saveDirty();
    this.critical_lines.remove();
    delete this.critical_lines;
}

/**
 * Draw the issue on the chart
 *
 * @return PlanningIssue Provides fluent interface
 */
PlanningIssue.prototype.draw = function()
{
    // If no geometry has been calcalated, do so and return to avoid recursion
    if (!this.geometry)
        return this.update();

    if (!this.element)
    {
        this.element = this.chart.paper.rect(
            this.geometry.x,
            this.geometry.y,
            this.geometry.width,
            this.geometry.height,
            this.chart.options.issue_border_radius
        );
        this.element.attr({
            'stroke': this.chart.options.issue_stroke_color,
            'fill': this.chart.options.issue_fill_color,
            'r': this.chart.options.issue_border_radius
        });
        this.element.mousemove(PlanningIssue_changeCursor, this);
        this.element.mouseout(PlanningIssue_closeTooltip, this);
        this.element.drag(PlanningIssue_dragMove, PlanningIssue_dragStart, PlanningIssue_dragEnd, this, this, this);
    }
    else
        this.element.attr(this.geometry);

    if (!this.text)
    {
        this.text = this.chart.paper.text(
            this.geometry.x + (this.geometry.width / 2),
            this.geometry.y + (this.geometry.height / 2),
            this.name
        )
        .attr({
            'font-size': 10,
            'cursor': 'move'
        });
        this.text.mousemove(PlanningIssue_changeCursor, this);
        this.text.mouseout(PlanningIssue_closeTooltip, this);
        this.text.drag(PlanningIssue_dragMove, PlanningIssue_dragStart, PlanningIssue_dragEnd, this, this, this);
    }
    else
    {
        this.text.attr({
            x: this.geometry.x + (this.geometry.width / 2),
            y: this.geometry.y + (this.geometry.height / 2)
        });
    }

    return this;
}

/** IssueRelation class definition */
function PlanningIssueRelation(data)
{
    this.from = data['from'];
    this.to = data['to'];
    this.type = data['type'];
    this.id = data['id'];

    this.element = null;
    this.chart = null;
}

/**
 * Set the chart element to which this relation is attached
 * 
 * @return PlanningIssueRelation Provides fluent interface
 */
PlanningIssueRelation.prototype.setChart = function(chart, idx)
{
    this.chart = chart;
    this.idx = idx;
    return this;
};

/** 
 * Draw the relation between two issues using a SVG path element 
 * 
 * @return PlanningIssueRelation Provides fluent interface
 */
PlanningIssueRelation.prototype.draw = function()
{
    // Get relevant geometry
    var from_geo = this.chart.issues[this.from].geometry;
    var to_geo = this.chart.issues[this.to].geometry; 

    // Storage for path points
    var points = [];
    
    // Starting point is outgoing issue
    points.push([
        from_geo.x + from_geo.width,
        from_geo.y + (from_geo.height / 2.0)
    ]);
    
    // Extend from outgoing issue by set X-spacing
    points.push([
        points[0][0] + this.chart.options.spacing[0],
        points[0][1]
    ]);

    // If the to-issue starts before the current X coordinate, we need two
    // additional points on the path
    if (to_geo.x < points[1][0])
    {
        // First the point just above the to-issue
        points.push([
            points[1][0],
            to_geo.y - (this.chart.options.spacing[1] / 2.0)
        ]);

        // Then move left to X-spacing pixels before the to-issue
        points.push([
            to_geo.x - this.chart.options.spacing[0],
            points[2][1]
        ]);
    }

    // Move to X-spacing pixels before the to-issue, in the center of the issue
    points.push([
        points[points.length - 1][0],
        to_geo.y + (to_geo.height / 2.0)
    ]);

    // Move to the issue itself
    points.push([
        to_geo.x,
        to_geo.y + (to_geo.height/ 2.0)
    ]);

    // Form the path: start by moving to the proper location
    var action = "M";
    var path = ""
    
    for (var point_idx in points)
    {
        // Iterate over all points and add them to the path string
        path += action + points[point_idx][0] + "," + points[point_idx][1];

        // All actions are draw line except the first
        action = "L";
    }

    // Create new element when necessary, otherwise update current element
    if (!this.element)
    {
        this.element = this.chart.paper.path(path);
        this.element.attr({
            'stroke': '#ff0000',
            'arrow-end': this.type == "blocks" ? 'diamond-wide-long' : 'classic-wide-long',
            'stroke-width': 2
        });
    }
    else
        this.element.attr('path', path);


    return this;
}

jQuery(function () {
    rm_chart = new PlanningChart();
    jQuery.getJSON('js/issues.php', updateIssues).error(errorHandler);

    var panel = jQuery('<div></div>');

    var back_button = jQuery('<button></button>');
    back_button.attr('type', 'button').text('Back 5 days').click(function () {
        rm_chart.base_date.setDate(rm_chart.base_date.getDate() - 5);
        rm_chart.draw();
    });

    var forward_button = jQuery('<button></button>');
    forward_button.attr('type', 'button').text('Forward 5 days').click(function () {
        rm_chart.base_date.setDate(rm_chart.base_date.getDate() + 5);
        rm_chart.draw();
    });

    panel.append(back_button, forward_button);
    rm_chart.container.after(panel);
});

function errorHandler(xhr_request)
{
    alert('AJAX error');
}

function updateIssues(json)
{
    for (var k in json['issues'])
        rm_chart.addIssue(new PlanningIssue(json['issues'][k]));

    for (var k in json['relations'])
        rm_chart.addRelation(new PlanningIssueRelation(json['relations'][k]));

    rm_chart.draw();
}