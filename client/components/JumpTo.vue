<template>
	<div
		v-if="isOpen"
		id="jump-to-container"
		@click="containerClick"
		@contextmenu.prevent="containerClick"
	>
		<div class="jump-to-dialog">
			<div class="jump-to-input">
				<input
					ref="input"
					:value="searchInput"
					placeholder="Jump to..."
					type="search"
					class="search input mousetrap"
					aria-label="Search among the channel list"
					tabindex="-1"
					@input="setSearchInput"
					@keydown.up="navigateResults($event, -1)"
					@keydown.down="navigateResults($event, 1)"
					@keydown.page-up="navigateResults($event, -10)"
					@keydown.page-down="navigateResults($event, 10)"
					@keydown.enter="selectResult"
				/>
			</div>
			<ul v-if="results.length" ref="results" class="results">
				<li
					v-for="[network, channel] in results"
					:key="channel.id"
					:class="{'active-result': channel === activeChannel}"
					v-on="{mouseover: () => setActive(channel)}"
					@click="close"
				>
					<Channel :channel="channel" :network="network" />
				</li>
			</ul>
			<div v-else class="no-results">
				No results found.
			</div>
		</div>
	</div>
</template>

<script>
import Mousetrap from "mousetrap";
import {filter as fuzzyFilter} from "fuzzy";

import Channel from "./Channel.vue";

export default {
	name: "JumpTo",
	components: {
		Channel,
	},
	data() {
		return {
			isOpen: false,
			searchInput: "",
			activeChannel: null,
		};
	},
	computed: {
		items() {
			// Array of [network, channel] tuples
			const items = [];

			for (const network of this.$store.state.networks) {
				for (const channel of network.channels) {
					if (
						this.$store.state.activeChannel &&
						channel === this.$store.state.activeChannel.channel
					) {
						continue;
					}

					items.push([network, channel]);
				}
			}

			// Sort by most unreads
			items.sort((a, b) => {
				return b[1].unread - a[1].unread;
			});

			return items;
		},
		results() {
			const results = fuzzyFilter(this.searchInput, this.items, {
				extract: (item) => item[1].name,
			}).map((item) => item.original);

			return results;
		},
	},
	watch: {
		results() {
			if (!this.results.length) {
				return;
			}

			if (!this.activeChannel || !this.results.find((r) => r[1] === this.activeChannel)) {
				this.setActive();
			}
		},
	},
	mounted() {
		Mousetrap.bind("esc", this.close);
		Mousetrap.bind("alt+j", this.open);
	},
	destroyed() {
		Mousetrap.unbind("esc", this.close);
		Mousetrap.unbind("alt+j", this.open);
	},
	methods: {
		open(event) {
			event.preventDefault();
			this.activeChannel = null;
			this.searchInput = "";
			this.isOpen = true;
			this.setActive();

			this.$nextTick(() => {
				this.$refs.input.focus();
			});
		},
		setActive(channel) {
			if (!this.results.length) {
				return;
			}

			if (!channel) {
				channel = this.results[0][1];
			}

			this.activeChannel = channel;
		},
		close() {
			if (!this.isOpen) {
				return;
			}

			this.isOpen = false;
		},
		setSearchInput(e) {
			this.searchInput = e.target.value;
		},
		containerClick(event) {
			if (event.currentTarget === event.target) {
				this.close();
			}
		},
		selectResult() {
			if (!this.results.length) {
				return;
			}

			this.$root.switchToChannel(this.activeChannel);
			this.close();
		},
		navigateResults(event, direction) {
			// Prevent propagation to stop global keybind handler from capturing pagedown/pageup
			// and redirecting it to the message list container for scrolling
			event.stopImmediatePropagation();
			event.preventDefault();

			const channels = this.results.map((r) => r[1]);

			// Bail out if there's no channels to select
			if (!channels.length) {
				this.activeChannel = null;
				return;
			}

			let currentIndex = channels.indexOf(this.activeChannel);

			// If there's no active channel select the first or last one depending on direction
			if (!this.activeChannel || currentIndex === -1) {
				this.activeChannel = direction ? channels[0] : channels[channels.length - 1];
				this.scrollToActive();
				return;
			}

			currentIndex += direction;

			// Wrap around the list if necessary. Normaly each loop iterates once at most,
			// but might iterate more often if pgup or pgdown are used in a very short list
			while (currentIndex < 0) {
				currentIndex += channels.length;
			}

			while (currentIndex > channels.length - 1) {
				currentIndex -= channels.length;
			}

			this.activeChannel = channels[currentIndex];
			this.scrollToActive();
		},
		scrollToActive() {
			// Scroll the list if needed after the active class is applied
			this.$nextTick(() => {
				const el = this.$refs.results.querySelector(".active-result");

				if (el) {
					el.scrollIntoView({block: "nearest", inline: "nearest"});
				}
			});
		},
	},
};
</script>
