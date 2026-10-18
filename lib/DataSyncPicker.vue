<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-body'>
            <div class='d-flex align-items-center'>
                <IconCloudPin
                    :size='28'
                    stroke='1'
                />
                <span class='mx-2'>Add to Data Sync</span>
            </div>
        </div>
        <div class='modal-body text-body'>
            <TablerLoading v-if='loading' />
            <TablerInlineAlert
                v-else-if='error'
                severity='danger'
                title='Could not load Data Syncs'
                :description='error'
            />
            <EmptyInfo
                v-else-if='!missions.length'
                type='Data Syncs'
            />
            <div
                v-else
                class='rubber-sync-list overflow-auto'
                role='group'
                aria-label='Data Syncs'
            >
                <div
                    v-for='mission in missions'
                    :key='mission.guid'
                    class='rubber-sync-row cursor-pointer cloudtak-hover py-2 rounded d-flex align-items-center'
                    role='checkbox'
                    tabindex='0'
                    :aria-checked='isSelected(mission)'
                    @click='toggle(mission)'
                    @keydown.enter.prevent='toggle(mission)'
                    @keydown.space.prevent='toggle(mission)'
                >
                    <IconCheck
                        v-if='isSelected(mission)'
                        :size='32'
                        stroke='1'
                        class='ms-3 flex-shrink-0'
                    />
                    <IconCloudPin
                        v-else
                        :size='32'
                        stroke='1'
                        class='ms-3 flex-shrink-0'
                    />
                    <span
                        class='mx-2 text-break'
                        v-text='mission.name'
                    />
                </div>
            </div>
        </div>
        <div class='modal-footer'>
            <TablerButton
                title='Cancel'
                @click='emit("close")'
            >
                Cancel
            </TablerButton>
            <div class='ms-auto'>
                <TablerButton
                    class='btn-primary'
                    title='Add to the selected Data Syncs'
                    :disabled='selected.length === 0'
                    @click='confirm'
                >
                    <IconShare2
                        :size='20'
                        stroke='1'
                        class='me-2'
                    />
                    Add to Data Sync
                </TablerButton>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { onMounted, ref } from 'vue';
import {
    TablerButton,
    TablerInlineAlert,
    TablerLoading,
    TablerModal,
} from '@tak-ps/vue-tabler';
import { IconCheck, IconCloudPin, IconShare2 } from '@tabler/icons-vue';
// Host component (the plugin is built inside app/plugins/<name>/, like lib/overlay.ts).
import EmptyInfo from '../../../src/components/CloudTAK/util/EmptyInfo.vue';
import { listMissionsForPicker } from './missions.ts';
import type { MissionChoice } from './ui-state.ts';

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'confirm', missions: MissionChoice[]): void;
}>();

const loading = ref(true);
const error = ref('');
const missions = ref<MissionChoice[]>([]);
const selected = ref<string[]>([]);

onMounted(async () => {
    try {
        missions.value = await listMissionsForPicker();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
});

function isSelected(mission: MissionChoice): boolean {
    return selected.value.includes(mission.guid);
}

function toggle(mission: MissionChoice): void {
    selected.value = isSelected(mission)
        ? selected.value.filter((guid) => guid !== mission.guid)
        : [...selected.value, mission.guid];
}

function confirm(): void {
    emit('confirm', missions.value.filter((mission) => isSelected(mission)));
}
</script>

<style scoped>
.rubber-sync-list {
    max-height: 40vh;
}

.rubber-sync-row {
    min-height: 44px;
}

@media (pointer: coarse) {
    .modal-footer :deep(.btn) {
        min-height: 44px;
    }
}
</style>
