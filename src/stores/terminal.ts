import { nextTick, reactive } from 'vue'
import { defineStore } from 'pinia'
import { STORE_TERMINAL } from '/@/stores/constant/cacheKey'
import { Terminal } from '/@/stores/interface/index'
import { timeFormat } from '/@/utils/common'
import { buildTerminalUrl } from '/@/api/install/index'
import { uuid } from '/@/utils/common'
import { taskStatus } from '/@/components/terminal/constant'

export const useTerminal = defineStore(
    'terminal',
    () => {
        const state: Terminal = reactive({
            show: false,
            showDot: false,
            taskList: [],
        })

        function init() {
            for (const key in state.taskList) {
                if (state.taskList[key].status == taskStatus.Connecting || state.taskList[key].status == taskStatus.Executing) {
                    state.taskList[key].status = taskStatus.Unknown
                }
            }
        }

        function toggle(val: boolean = !state.show) {
            state.show = val
            if (val) {
                toggleDot(false)
            }
        }

        function toggleDot(val: boolean = !state.showDot) {
            state.showDot = val
        }

        function setTaskStatus(idx: number, status: number) {
            state.taskList[idx].status = status
            if ((status == taskStatus.Failed || status == taskStatus.Unknown) && state.taskList[idx].blockOnFailure) {
                setTaskShowMessage(idx, true)
            }

            if (status == taskStatus.Failed || status == taskStatus.Unknown) {
                state.taskList[idx].callback(taskStatus.Failed)
            } else if (status == taskStatus.Success) {
                state.taskList[idx].callback(taskStatus.Success)
            }
        }

        function setTaskShowMessage(idx: number, val: boolean = !state.taskList[idx].showMessage) {
            state.taskList[idx].showMessage = val
        }

        function addTaskMessage(idx: number, message: string) {
            if (!state.show) toggleDot(true)
            state.taskList[idx].message = state.taskList[idx].message.concat(message)
            nextTick(() => {
                execMessageScrollbarKeep(state.taskList[idx].uuid)
            })
        }

        function addTask(command: string, blockOnFailure: boolean = true, callback: Function = () => {}) {
            if (!state.show) toggleDot(true)
            state.taskList = state.taskList.concat({
                uuid: uuid(),
                createtime: timeFormat(),
                status: taskStatus.Waiting,
                command: command,
                message: [],
                showMessage: false,
                blockOnFailure: blockOnFailure,
                callback: callback,
            })

            // 清理任务列表
            // clearSuccessTask()

            startTask()
        }

        function delTask(idx: number) {
            if (state.taskList[idx].status != taskStatus.Connecting && state.taskList[idx].status != taskStatus.Executing) {
                state.taskList.splice(idx, 1)
            }
            startTask()
        }

        function startTask() {
            let taskKey = null

            // 寻找可以开始执行的命令
            for (const key in state.taskList) {
                if (state.taskList[key].status == taskStatus.Waiting) {
                    taskKey = parseInt(key)
                    break
                }
                if (state.taskList[key].status == taskStatus.Connecting || state.taskList[key].status == taskStatus.Executing) {
                    break
                }
                if (state.taskList[key].status == taskStatus.Success) {
                    continue
                }
                if (state.taskList[key].status == taskStatus.Failed || state.taskList[key].status == taskStatus.Unknown) {
                    if (state.taskList[key].blockOnFailure) {
                        break
                    } else {
                        continue
                    }
                }
            }
            if (taskKey !== null) {
                setTaskStatus(taskKey, taskStatus.Connecting)
                startEventSource(taskKey)
            }
        }

        function startEventSource(taskKey: number) {
            window.eventSource = new EventSource(buildTerminalUrl(state.taskList[taskKey].command, state.taskList[taskKey].uuid))
            window.eventSource.onmessage = function (e) {
                let data = JSON.parse(e.data)
                if (!data || !data.data) {
                    return
                }

                let taskIdx = findTaskIdxFromUuid(data.extend)
                if (taskIdx === false) {
                    return
                }

                if (data.data == 'command-exec-error') {
                    setTaskStatus(taskIdx, taskStatus.Failed)
                    window.eventSource.close()
                    startTask()
                } else if (data.data == 'command-exec-completed') {
                    window.eventSource.close()
                    if (state.taskList[taskIdx].status != taskStatus.Success) {
                        setTaskStatus(taskIdx, taskStatus.Failed)
                    }
                    startTask()
                } else if (data.data == 'command-link-success') {
                    setTaskStatus(taskIdx, taskStatus.Executing)
                } else if (data.data == 'command-exec-success') {
                    setTaskStatus(taskIdx, taskStatus.Success)
                } else {
                    addTaskMessage(taskIdx, data.data)
                }
            }
            window.eventSource.onerror = function (e) {
                window.eventSource.close()
                setTaskStatus(taskKey, taskStatus.Failed)
            }
        }

        function retryTask(idx: number) {
            state.taskList[idx].message = []
            setTaskStatus(idx, taskStatus.Waiting)
            startTask()
        }

        function clearSuccessTask() {
            state.taskList = state.taskList.filter((item) => item.status != taskStatus.Success)
        }

        function findTaskIdxFromUuid(uuid: string) {
            for (const key in state.taskList) {
                if (state.taskList[key].uuid == uuid) {
                    return parseInt(key)
                }
            }
            return false
        }

        function execMessageScrollbarKeep(uuid: string) {
            let execMessageEl = document.querySelector('.exec-message-' + uuid) as Element
            if (execMessageEl && execMessageEl.scrollHeight) {
                execMessageEl.scrollTop = execMessageEl.scrollHeight
            }
        }

        return {
            state,
            init,
            toggle,
            toggleDot,
            setTaskStatus,
            setTaskShowMessage,
            addTaskMessage,
            addTask,
            delTask,
            startTask,
            retryTask,
            clearSuccessTask,
        }
    },
    {
        persist: {
            key: STORE_TERMINAL,
        },
    }
)