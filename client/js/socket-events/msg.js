"use strict";

import socket from "../socket";
import cleanIrcMessage from "../helpers/ircmessageparser/cleanIrcMessage";
import store from "../store";
import {switchToChannel} from "../router";

let pop;

try {
	pop = new Audio();
	pop.src = "audio/pop.wav";
} catch (e) {
	pop = {
		play() {},
	};
}

socket.on("msg", function(data) {
	const receivingChannel = store.getters.findChannel(data.chan);

	if (!receivingChannel) {
		return;
	}

	let channel = receivingChannel.channel;
	const isActiveChannel =
		store.state.activeChannel && store.state.activeChannel.channel === channel;

	// Display received notices and errors in currently active channel.
	// Reloading the page will put them back into the lobby window.
	// We only want to put errors/notices in active channel if they arrive on the same network
	if (
		data.msg.showInActive &&
		store.state.activeChannel &&
		store.state.activeChannel.network === receivingChannel.network
	) {
		channel = store.state.activeChannel.channel;

		if (data.chan === channel.id) {
			// If active channel is the intended channel for this message,
			// remove the showInActive flag
			data.msg.showInActive = false;
		} else {
			data.chan = channel.id;
		}
	} else if (!isActiveChannel) {
		// Do not set unread counter for channel if it is currently active on this client
		// It may increase on the server before it processes channel open event from this client

		if (typeof data.highlight !== "undefined") {
			channel.highlight = data.highlight;
		}

		if (typeof data.unread !== "undefined") {
			channel.unread = data.unread;
		}
	}

	channel.messages.push(data.msg);

	if (data.msg.self) {
		channel.firstUnread = data.msg.id;
	} else {
		notifyMessage(data.chan, channel, store.state.activeChannel, data.msg);
	}

	let messageLimit = 0;

	if (!isActiveChannel) {
		// If message arrives in non active channel, keep only 100 messages
		messageLimit = 100;
	} else if (channel.scrolledToBottom) {
		// If message arrives in active channel, keep 500 messages if scroll is currently at the bottom
		messageLimit = 500;
	}

	if (messageLimit > 0 && channel.messages.length > messageLimit) {
		channel.messages.splice(0, channel.messages.length - messageLimit);
		channel.moreHistoryAvailable = true;
	}

	if (channel.type === "channel") {
		updateUserList(channel, data.msg);
	}
});

function notifyMessage(targetId, channel, activeChannel, msg) {
	if (msg.highlight || (store.state.settings.notifyAllMessages && msg.type === "message")) {
		if (!document.hasFocus() || !activeChannel || activeChannel.channel !== channel) {
			if (store.state.settings.notification) {
				try {
					pop.play();
				} catch (exception) {
					// On mobile, sounds can not be played without user interaction.
				}
			}

			if (
				store.state.settings.desktopNotifications &&
				"Notification" in window &&
				Notification.permission === "granted"
			) {
				let title;
				let body;

				if (msg.type === "invite") {
					title = "New channel invite:";
					body = msg.from.nick + " invited you to " + msg.channel;
				} else {
					title = msg.from.nick;

					if (channel.type !== "query") {
						title += ` (${channel.name})`;
					}

					if (msg.type === "message") {
						title += " says:";
					}

					body = cleanIrcMessage(msg.text);
				}

				const timestamp = Date.parse(msg.time);

				try {
					if (store.state.hasServiceWorker) {
						navigator.serviceWorker.ready.then((registration) => {
							registration.active.postMessage({
								type: "notification",
								chanId: targetId,
								timestamp: timestamp,
								title: title,
								body: body,
							});
						});
					} else {
						const notify = new Notification(title, {
							tag: `chan-${targetId}`,
							badge: "img/icon-alerted-black-transparent-bg-72x72px.png",
							icon: "img/icon-alerted-grey-bg-192x192px.png",
							body: body,
							timestamp: timestamp,
						});
						notify.addEventListener("click", function() {
							this.close();
							window.focus();

							const channelTarget = store.getters.findChannel(targetId);

							if (channelTarget) {
								switchToChannel(channelTarget);
							}
						});
					}
				} catch (exception) {
					// `new Notification(...)` is not supported and should be silenced.
				}
			}
		}
	}
}

function updateUserList(channel, msg) {
	if (msg.type === "message" || msg.type === "action") {
		const user = channel.users.find((u) => u.nick === msg.from.nick);

		if (user) {
			user.lastMessage = new Date(msg.time).getTime() || Date.now();
		}
	} else if (msg.type === "quit" || msg.type === "part") {
		const idx = channel.users.findIndex((u) => u.nick === msg.from.nick);

		if (idx > -1) {
			channel.users.splice(idx, 1);
		}
	} else if (msg.type === "kick") {
		const idx = channel.users.findIndex((u) => u.nick === msg.target.nick);

		if (idx > -1) {
			channel.users.splice(idx, 1);
		}
	}
}
