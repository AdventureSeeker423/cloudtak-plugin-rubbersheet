<template>
    <TablerModal size='sm'>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-body'>
            <div class='d-flex align-items-center'>
                <IconTrash
                    :size='28'
                    stroke='1'
                />
                <span class='mx-2'>Remove Sheet?</span>
            </div>
        </div>
        <div class='modal-body text-body'>
            The sheet and its map position are removed. Exported files are not affected.
        </div>
        <div class='modal-footer'>
            <TablerButton
                title='Keep the sheet'
                @click='emit("close")'
            >
                Cancel
            </TablerButton>
            <div class='ms-auto'>
                <TablerButton
                    class='btn-danger'
                    title='Remove Sheet'
                    @click='emit("confirm")'
                >
                    <IconTrash
                        :size='20'
                        stroke='1'
                        class='me-2'
                    />
                    Remove Sheet
                </TablerButton>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { TablerButton, TablerModal } from '@tak-ps/vue-tabler';
import { IconTrash } from '@tabler/icons-vue';

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'confirm'): void;
}>();
</script>
