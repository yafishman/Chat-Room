// Require the packages we will use:
let http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");
  let rooms = {};
  let users = [];
  let passwords = {};
  let creators = {};
  let banned = {};
  let socketIds = {};
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
let app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.

	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.

		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);

// Do the Socket.IO magic:
let io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.

	socket.on('send_message', function(msg,user,room) {
		// This callback runs when the server receives a new message from the client.
		io.sockets.in(room).emit('send_message', user, msg); // broadcast the message to other users
	});
	socket.on('like_message', function(msg,likes,room){
		io.sockets.in(room).emit('like_message', msg);
	});
  socket.on('send_private_message', function(msg,user,userTo) {
		// This callback runs when the server receives a new message from the client.

		io.to(socketIds[userTo]).emit('send_private_message', user,msg); // broadcast private message to the user
	});
	//runs when a new user enters a name
  socket.on('add_user', function(username) {
    if(users.includes(username)) {
      console.log("Username taken");
      socket.emit('user_taken', username);
    } else {
      socket.username = username;
      socketIds[username]= socket.id;
      users.push(username);
      console.log("Logged in as: " + username);
      socket.emit('login', username);
      socket.emit('loadRooms',Object.keys(rooms),Object.keys(passwords));
    }
	});
  socket.on('disconnect', function(){
		// remove the username from global usernames list
		delete users[socket.username];
		// update list of users in chat, client-side
		// echo globally that this client has left
		socket.leave(socket.room);
	});
	//runs when user joins a public room
  socket.on('join_room', function(room,user,oldRoom) {
    if(!banned[room]) {
        if(oldRoom != 'Lobby') {
          rooms[oldRoom].splice(rooms[oldRoom].indexOf(user),1);
          io.sockets.in(oldRoom).emit('updateUsers', room,rooms[oldRoom],creators[room]);
          socket.leave(oldRoom);
        }
        socket.username=user;
        socket.room=room;
        if(!rooms[room].includes(user)) {
          rooms[room].push(user);
        }
        socket.join(room);
        socket.emit('join_Room', room);
        io.sockets.in(room).emit('updateUsers', room,rooms[room],creators[room]);
    } else {
      if(!banned[room].includes(user)) {
        if(oldRoom != 'Lobby') {
          rooms[oldRoom].splice(rooms[oldRoom].indexOf(user),1);
          io.sockets.in(oldRoom).emit('updateUsers', room,rooms[oldRoom],creators[room]);
          socket.leave(oldRoom);
        }
        socket.username=user;
        socket.room=room;
        if(!rooms[room].includes(user)) {
          rooms[room].push(user);
        }
        socket.join(room);
        socket.emit('join_Room', room);
        io.sockets.in(room).emit('updateUsers', room,rooms[room],creators[room]);
      }
    }
	});
	//runs when user joins a private room
  socket.on('join_private_room', function(room,pass,user,oldRoom) {
    if(passwords[room]==pass) {
      if(!banned[room]) {
        if(oldRoom != 'Lobby') {
          rooms[oldRoom].splice(rooms[oldRoom].indexOf(user),1);
          io.sockets.in(oldRoom).emit('updateUsers', room,rooms[oldRoom],creators[room]);
          socket.leave(socket.room);
        }
        socket.username=user;
        socket.room=room;
        if(!rooms[room].includes(user)) {
          rooms[room].push(user);
        }
        socket.join(room);
        socket.emit('join_Room', room);
        io.sockets.in(room).emit('updateUsers', room,rooms[room],creators[room]);
      } else {
          if(!banned[room].includes(user)) {
            if(oldRoom != 'Lobby') {
              rooms[oldRoom].splice(rooms[oldRoom].indexOf(user),1);
              io.sockets.in(oldRoom).emit('updateUsers', room,rooms[oldRoom],creators[room]);
              socket.leave(socket.room);
            }
            socket.username=user;
            socket.room=room;
            if(!rooms[room].includes(user)) {
              rooms[room].push(user);
            }
            socket.join(room);
            socket.emit('join_Room', room);
            io.sockets.in(room).emit('updateUsers', room,rooms[room],creators[room]);
          }
        }
      } else {
      io.to(socketIds[user]).emit('incorrect');
    }
	});
	//runs when user creates a public room
  socket.on('create_room', function(room,user,oldRoom) {
    let roomUsers = [user];
    if(!(room in rooms)) {
      rooms[room] = roomUsers;
      creators[room] = user;
      if(oldRoom != 'Lobby') {
        rooms[oldRoom].splice(rooms[oldRoom].indexOf(user),1);
        io.sockets.in(oldRoom).emit('updateUsers', room,rooms[oldRoom],creators[room]);
        socket.leave(socket.room);
      }
      socket.username=user;
      socket.room=room;
      banned[room] = [];
      socket.join(room);
      io.emit('updateRooms', room,Object.keys(rooms),Object.keys(passwords));
      socket.emit('updateChat');
      io.sockets.in(room).emit('updateUsers', room,rooms[room],user);
    } else {
      console.log("Room already exists");
    }

	});
	//runs when user creates a private room
  socket.on('create_private', function(room,user,pass,oldRoom) {
    let roomUsers = [user];
    if(!(room in rooms)) {
      rooms[room] = roomUsers;
      passwords[room]=pass;
      creators[room] = user;
      if(oldRoom != 'Lobby') {
        rooms[oldRoom].splice(rooms[oldRoom].indexOf(user),1);
        io.sockets.in(oldRoom).emit('updateUsers', room,rooms[oldRoom],creators[room]);
        socket.leave(socket.room);
      }
      banned[room] = [];
      socket.username=user;
      socket.room=room;
      socket.join(room);
      io.emit('updateRooms', room,Object.keys(rooms),Object.keys(passwords));
      io.sockets.in(room).emit('updateUsers', room,rooms[room],creators[room]);
    } else {
      console.log("Room already exists");
    }

	});
//runs when user leaves a room
  socket.on('leave_room', function(user,room) {
    socket.leave(room);
	});

  socket.on('updateAll', function(room) {
    socket.leave(room);
	});
	//runs when a user's temporarily banned
  socket.on('temp_ban', function(room,userTo) {
    rooms[room].splice(rooms[room].indexOf(userTo),1);
    io.sockets.in(room).emit('updateUsers', room,rooms[room],creators[room]);
    io.to(socketIds[userTo]).emit('kick', userTo,room);
	});
	//runs when a user's permanently kicked
  socket.on('perm_ban', function(room,userTo) {
    rooms[room].splice(rooms[room].indexOf(userTo),1);
    banned[room].push(userTo);
    io.sockets.in(room).emit('updateUsers', room,rooms[room],creators[room]);
    io.to(socketIds[userTo]).emit('ban', userTo,room);
	});
});
