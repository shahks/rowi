function ROSPlotGUI(el, options) {
  //var that = this;
  //console.log(this);
  //console.log(that);
  this.parent_el = el;
  this.el = $('<div>').appendTo(el);
  this.el.width(600);
  this.el.height(400);
  this.ros = options.ros;
  this.num_points = 100;
  this.first = true;

  var initial_data = [];
  for (var i = 0; i < this.num_points; ++i) {
    initial_data.push([i, 0]);
  }

  this.plot = $.plot(this.el, [initial_data], {
    series: {
      shadowSize: 0,
    },
    yaxis: {
      min: -1.0,
      max: 1.0
    },
    xaxis: {
      show: false
    }
  });

  this.data = [];

  ROWI.ros.getTopics(this.list_callback.bind(this));
/*  ROWI.ros.getServices(function(msg){
    console.log(msg);
  })
*/
  //console.log(callback);


  // implement rostopic.get_topic_type
  // https://github.com/ros/ros_comm/blob/indigo-devel/tools/rostopic/src/rostopic/__init__.py
  // to parse paths such as: /knarr/imu/data/angular_velocity/z

  // this.imu_listener = new ROSLIB.Topic({
  //     ros: ROWI.ros,
  //     name        : '/knarr/imu/data',
  //     messageType : 'sensor_msgs/Imu',
  //     throttle_rate : 100
  // });
  //
  // this.imu_listener.subscribe(this.update.bind(this));

}
ROSPlotGUI.prototype.close = function() {
  this.parent_el.empty();
}
//ROSPlotGUI.prototype.update = function(field, msg);
ROSPlotGUI.prototype.update = function(field, msg) {
  //console.log(msg);
  //console.log(field);
  console.log("hello");
  if(this.data.length > this.num_points) {
    this.data = this.data.slice(1); // remove first point when data is too long
  }

  if(field[1] == undefined){
    this.data.push(msg[field[0]]);
  }
  else {
    this.data.push(msg[field[0]][field[1]]);
  }

  var res = [];
  for (var i = 0; i < this.data.length; ++i) {
    res.push([i, this.data[i]])
  }

  this.plot.setData([res])
  this.plot.draw();
  // data should be of this format: [[x,y],[x,y],[x,y]] ?
}

ROSPlotGUI.prototype.list_callback = function(list) {
  var that = this;
  var div = $('<div id="container">').appendTo(this.parent_el);
  div.jstree({
    'core': {
      'check_callback': true,
      'multiple' : false,
      //whole_node: false,
    },
    checkbox: {
      //tie_selection : false,
      multiple : false,
      whole_node : false,
    },
    plugins: ["checkbox","sort"],
  });
  var tree = div.jstree();

  list.each(function(node) {
    var abc = get_tree_node(node,node);
  });

  div.on('activate_node.jstree', function(e,data) {
    this.clear();

    if (this.listener != undefined){
      console.log(this.listener);
      this.listener.unsubscribe();
    }
    //console.log(data.node);
    var current = data.node;
    if(current.id.indexOf("id") == 0 ){
      par = tree.get_node(current.parent);
    }
    else {
      par = tree.get_node(tree.get_node(current.parent).parent);
    }
    console.log(par);
    var t_name = "";
    while(par.id != "#"){
      var suffix = par.text;
      var temp = suffix.concat("/",t_name);
      t_name = temp;
      par = tree.get_node(par.parent);
    }
    t_name = t_name.substring(0,t_name.length-1);
    t_name = "/".concat(t_name);
    console.log("t_name is:" + t_name);

    var name = "";
    while(current.id != "#"){
      var suffix = current.text;
      var temp = suffix.concat("/",name);
      name = temp;
      current = tree.get_node(current.parent);
    }
    name = name.substring(0,name.length-1);
    name = "/".concat(name);
    console.log("name is:" + name);
    //console.log("topic_name is: " + topic_name);
    var ex = name.split(t_name);
    var field = ex[1].substring(1,ex[1].length).split('/');
    console.log("field:" + field );


    if (data.node.children.length == 0) {
      ROWI.ros.getTopicType(topic_name, function(message){

        this.listener = new ROSLIB.Topic({
            ros           : ROWI.ros,
            name          : t_name, //'/knarr/imu/data',
            messageType   : message,    //'sensor_msgs/Imu',
            throttle_rate : 100
        });

        this.listener.subscribe(this.update.bind(this,field));
      }.bind(this));

    }
  }.bind(this));

  div.on('open_node.jstree', function(e,data) {
      for(var i=0; i<data.node.children.length; i++){
         var n = data.instance.get_node(data.node.children[i]);
         if(n.text=="DELETE") {
           data.instance.delete_node(n);
         }
      }
      //if leaf node load the parameters
      if(data.node.children.length == 0){
        topic_name = data.node.original.action;
        extra = data.node;
        var arr = [];
//        ROWI.ros.getTopicType(topic_name,this.msg_callback.bind(this,extra));

        ROWI.ros.getTopicType(topic_name, function(message){  //Get list of all available topics
          tree.uncheck_node(extra);
          ROWI.ros.getMessageDetails(message, function(data){
            msg_details = ROWI.ros.decodeTypeDefs(data);
            for(var key in msg_details){
              // create child list for every element in msg_details
              child_list = [];
              if(typeof (msg_details[key]) == "object"){
                for (var prop in msg_details[key]){
                  child_list.add(prop);
                }
              }
              //create child as each element
              var self_id = extra.id + "_" + key;
              tree.create_node(extra.id, extra.original.open_callback(self_id, key,child_list));
            }
          })
        });
      }
    }.bind(this));

//}

function split_ns(ns){
  return ns.split('/');
}

function get_parent_ns(ns){
  var res = ns.split('/').to(-1).join('/');
  if(res.length > 0) {
    return res;
  } else {
    return '/';
  }
}

function get_last_ns(ns){
  var abc = ns.split('/');
  return abc[abc.length - 1];
}

function id_gen_ns(prefix,ns){
  var abc = ns.split('/');
  var suffix = abc.join('_');
  //return suffix;
  return prefix.concat(suffix);
}

function get_tree_node(ns,action){
  if (ns == '/'){
    return null;
  }
  var my_id = id_gen_ns("id",ns);
  var res = tree.get_node(my_id);
  if (res){
    return res;
  }
  else{
    var parent_ns = get_parent_ns(ns);
    var parent = get_tree_node(parent_ns);
    tree.create_node(parent,{
      id: my_id,
      action: action,
      text: get_last_ns(ns),
      children: ['DELETE'],
      open_callback: function(id, text, children) { return {'id':id,'text':text, 'children': children}},
      children_loaded: false,
    });
    return tree.get_node(my_id);
  }
}
}

ROSPlotGUI.prototype.clear = function ()
{
  // this.plot.empty();
  this.data = [];
  this.plot.setData([])
  this.plot.draw();
}
