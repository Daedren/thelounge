<template>
	<div
		v-if="isOpen"
		id="mentions-popup-container"
		@click="containerClick"
		@contextmenu.prevent="containerClick"
	>
		<div class="mentions-popup">
			<div class="mentions-popup-title">
				Recent mentions
				<span v-if="isLoading">- Loading…</span>
			</div>
			<template v-if="resolvedMessages.length === 0">
				<p>There are no recent mentions.</p>
			</template>
			<template v-for="message in resolvedMessages" v-else>
				<div :key="message.id" :class="['msg', message.type]">
					<span class="from">
						<Username :user="message.from" />
						<template v-if="message.channel">
							in {{ message.channel.channel.name }} on
							{{ message.channel.network.name }}
						</template>
						<template v-else>
							in unknown channel
						</template>
					</span>
					<span :title="message.time | localetime" class="time">
						{{ messageTime(message.time) }}
					</span>
					<button
						class="msg-hide"
						aria-label="Hide this mention"
						@click="hideMention(message)"
					></button>
					<div class="content" dir="auto">
						<ParsedMessage :network="null" :message="message" />
					</div>
				</div>
			</template>
		</div>
	</div>
</template>

<script>
import Username from "./Username.vue";
import ParsedMessage from "./ParsedMessage.vue";
import socket from "../js/socket";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default {
	name: "Mentions",
	components: {
		Username,
		ParsedMessage,
	},
	data() {
		return {
			isOpen: false,
			isLoading: false,
		};
	},
	computed: {
		resolvedMessages() {
			const messages = this.$store.state.mentions.slice().reverse();

			for (const message of messages) {
				message.channel = this.$store.getters.findChannel(message.chanId);
			}

			return messages;
		},
	},
	watch: {
		"$store.state.mentions"() {
			this.isLoading = false;
		},
	},
	mounted() {
		this.$root.$on("mentions:toggle", this.openPopup);
	},
	destroyed() {
		this.$root.$off("mentions:toggle", this.openPopup);
	},
	methods: {
		messageTime(time) {
			return dayjs(time).fromNow();
		},
		hideMention(message) {
			this.$store.state.mentions.splice(
				this.$store.state.mentions.findIndex((m) => m.msgId === message.msgId),
				1
			);

			socket.emit("mentions:hide", message.msgId);
		},
		containerClick(event) {
			if (event.currentTarget === event.target) {
				this.isOpen = false;
			}
		},
		openPopup() {
			this.isOpen = !this.isOpen;

			if (this.isOpen) {
				this.isLoading = true;
				socket.emit("mentions:get");
			}
		},
	},
};
</script>
