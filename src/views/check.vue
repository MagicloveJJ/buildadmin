<template>
    <Header />
    <div class="container">
        <div class="table-title">{{ t('Environmental inspection') }}</div>
        <div class="table">
            <div v-if="state.showPortErrorPrompt" class="global-warning">
                <el-alert :closable="false" center type="error">
                    <template #default>
                        {{ t('Port error prompt 1') }}
                        <a target="_blank" href="https://wonderful-code.gitee.io/guide/install/start.html">{{ t('Get started quickly') }}</a>
                        {{ t('Port error prompt 3') }}
                    </template>
                </el-alert>
            </div>
            <transition-group name="slide-bottom">
                <div class="table-item" :class="idx" v-for="(item, idx) in state.envCheckData" :key="idx + item.describe + item.state">
                    <div class="table-label">
                        {{ idx.toString() == 'npm_package_manager' ? t(idx) + ' ' + getAmicablePackageManager() : t(idx) }}
                        <template v-if="item.link && item.link.length > 0">
                            <span
                                v-for="(link, linkidx) in item.link"
                                :key="linkidx"
                                :title="link.title ? link.title : ''"
                                @click="onLabelNeed(link)"
                                class="label-need"
                                :class="link.type"
                                >{{ link.name }}</span
                            >
                        </template>
                    </div>
                    <div class="table-value">
                        {{ item.describe }}
                        <img :title="t(state.stateTitle[item.state])" class="data-state" :src="getSrc(item.state)" :alt="item.state" />
                    </div>
                </div>
            </transition-group>

            <div v-if="state.checkTypeIndex != 'done'" class="table-item">
                <div class="table-label">{{ t('Checking installation environment') }}</div>
                <div class="table-value">
                    {{ t(state.checkType[state.checkTypeIndex]) }}
                    <img
                        :title="t('Current execution to:') + t(state.checkType[state.checkTypeIndex])"
                        class="data-state"
                        src="~assets/img/install/loading.gif"
                        :alt="t(state.checkType[state.checkTypeIndex])"
                    />
                </div>
            </div>

            <div class="check-done" :class="state.checkDoneIndex">{{ t(state.checkDone[state.checkDoneIndex]) }}</div>
            <div class="button" @click="goConfig" :class="state.checkDoneIndex == 'ok' ? 'pass' : ''">{{ t('Step 2 site configuration') }}</div>
        </div>
    </div>
    <el-dialog
        v-model="common.state.showStartDialog"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        :destroy-on-close="true"
        custom-class="ba-terminal-dialog"
        :title="t('Ready to start')"
        center
    >
        <el-form @keyup.enter="startInstall" class="start-from" label-position="left" label-width="120px" :model="state.startForm">
            <el-form-item :label="t('language')">
                <el-select @change="changeLang" class="w100" v-model="state.startForm.lang">
                    <el-option label="????????????" value="zh-cn"></el-option>
                    <el-option label="English" value="en"></el-option>
                </el-select>
            </el-form-item>
            <el-form-item :label="t('NPM package manager')">
                <el-select class="w100" v-model="state.startForm.packageManager">
                    <el-option label="npm" value="npm"></el-option>
                    <el-option label="cnpm" value="cnpm"></el-option>
                    <el-option :label="'pnpm' + t('recommend')" value="pnpm"></el-option>
                    <el-option :label="'yarn' + t('recommend')" value="yarn"></el-option>
                    <el-option label="ni" value="ni"></el-option>
                    <el-option :label="t('I want to execute the command manually')" value="none"></el-option>
                </el-select>
                <div class="block-help">
                    {{ t('The system has a Web terminal. Please select an installed or your favorite NPM package manager') }}
                </div>
            </el-form-item>
            <el-form-item :label="t('Set NPM source')">
                <el-radio-group v-model="state.startForm.setNpmRegistry" class="ml-4">
                    <el-radio label="none" size="large">{{ t('Use current source') }}</el-radio>
                    <el-radio label="taobao" size="large">{{ t('TaoBao') }}</el-radio>
                    <el-radio label="npm" size="large">NPM</el-radio>
                    <el-radio label="rednpm" size="large">RedNPM</el-radio>
                </el-radio-group>
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="startInstall" type="primary" size="large" round>
                <el-icon><Promotion /></el-icon>
                <span class="start-install">{{ t('Start installation') }}</span>
            </el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import Header from '../components/header/index.vue'
import { getEnvBaseCheck, getEnvNpmCheck } from '/@/api/install/index'
import { useI18n } from 'vue-i18n'
import { CheckState, CheckLink } from '/@/stores/interface/index'
import { useCommon } from '/@/stores/common'
import { useTerminal } from '/@/stores/terminal'
import { ElMessage } from 'element-plus'
import { taskStatus } from '/@/components/terminal/constant'
import { Promotion } from '@element-plus/icons-vue'
import { changePackageManager } from '/@/api/install/index'

const { t, locale } = useI18n()
const common = useCommon()
const terminal = useTerminal()

const state: CheckState = reactive({
    envCheckData: [],
    stateTitle: {
        ok: 'Environmental inspection passed',
        fail: 'This environmental check failed',
        warn: 'The environment check failed, but the installation can continue',
    },
    checkType: {
        base: 'Basic environment',
        npm: 'NPM correlation',
        npminstall: 'Test npm install',
        done: 'Check complete',
    },
    checkTypeIndex: 'base',
    checkDone: {
        ok: 'Congratulations, the installation can continue~',
        fail: 'Sorry, the necessary installation environment conditions have not been met, please check the above form!',
        executing: 'executing',
    },
    checkDoneIndex: 'executing',
    startForm: {
        lang: locale.value,
        packageManager: terminal.state.packageManager,
        setNpmRegistry: 'taobao',
    },
    showPortErrorPrompt: false,
})

const modules = import.meta.globEager('../assets/img/install/*.png')
const getSrc = (name: string) => {
    const path = `../assets/img/install/${name}.png`
    return modules[path].default
}

const changeLang = (val: string) => {
    window.localStorage.setItem('ba-lang', val)
    location.reload()
}

const startInstall = () => {
    if (common.state.showStartDialog) {
        changePackageManager(state.startForm.packageManager)
    }
    common.toggleStartDialog(false)
    // ??????????????????????????????
    getEnvBaseCheck().then((res) => {
        if (res.data.code != 1) {
            return showError(res.data.msg)
        }
        envNpmCheck()
        state.envCheckData = res.data.data
    })
}

/**
 * ????????????????????????
 */
const onLabelNeed = (link: CheckLink) => {
    if (link.type == 'faq') {
        window.open(link.url)
    } else if (link.type == 'install-package-manager') {
        // ??????????????????
        state.checkDoneIndex = 'executing'
        terminal.toggle(true)
        terminal.addTaskPM('install-package-manager', true, (res: number) => {
            terminal.toggle(false)
            checkSubmit()
            if (res == taskStatus.Failed) {
                showError(t('Sorry, the automatic installation of package manager failed. Please complete the installation manually!'))
            } else if (res == taskStatus.Success) {
                state.envCheckData = Object.assign({}, state.envCheckData, {
                    success: {
                        describe: t('PM is ready!'),
                        state: 'ok',
                        link: [],
                    },
                })
                state.envCheckData = Object.assign({}, state.envCheckData, {
                    npm_package_manager: {
                        describe: t('already installed'),
                        state: 'ok',
                        link: [],
                        pm: terminal.state.packageManager,
                    },
                })
                setNpmRegistry()
                addCheckNpmInstall()
            }
        })
    } else if (link.type == 'test-npm-install') {
        axiosNpmTestInstall()
    }
}

/**
 * ?????????????????????
 */
const goConfig = () => {
    if (state.checkDoneIndex == 'ok') {
        common.setStep('config')
    }
}

/**
 * ????????????????????????
 */
const showError = (msg: string) => {
    checkSubmit()
    if (state.checkDoneIndex == 'fail') {
        state.checkDoneIndex = 'executing' // ??????checkDone???????????????
    }
    ElMessage({
        type: 'error',
        message: msg,
        duration: 0,
        center: true,
    })
}

/**
 * ??????npm????????????
 */
const envNpmCheck = () => {
    state.checkTypeIndex = 'npm'
    getEnvNpmCheck().then((res) => {
        checkSubmit()
        if (res.data.code == 2) {
            return false
        } else if (res.data.code != 1) {
            return showError(res.data.msg)
        }
        state.envCheckData = Object.assign({}, state.envCheckData, res.data.data)

        if (res.data.data.npm_package_manager.state == 'ok') {
            setNpmRegistry()
            addCheckNpmInstall()
        }
    })
}

/**
 * ?????????
 */
const setNpmRegistry = () => {
    if (state.startForm.setNpmRegistry != 'none') {
        let exist = false
        for (const key in terminal.state.taskList) {
            if (
                terminal.state.taskList[key].command == 'set-registry.' + state.startForm.setNpmRegistry &&
                terminal.state.taskList[key].status == taskStatus.Success
            ) {
                exist = true
                break
            }
        }
        if (!exist) {
            terminal.addTask('set-registry.' + state.startForm.setNpmRegistry, false, (res: number) => {
                if (res == taskStatus.Failed) {
                    let npmInstall = {
                        'set-npm-registry': {
                            describe: t('Command execution failed'),
                            state: 'fail',
                            link: [
                                {
                                    // ????????????
                                    name: t('How to solve'),
                                    title: t('Click to see how to solve it'),
                                    type: 'faq',
                                    url: 'https://wonderful-code.gitee.io/guide/install/setNpmRegistryFail.html',
                                },
                            ],
                        },
                    }
                    state.envCheckData = Object.assign({}, state.envCheckData, npmInstall)
                }
            })
        }
    }
}

/**
 * ??????????????????npm install??????
 */
const addCheckNpmInstall = () => {
    state.envCheckData = Object.assign({}, state.envCheckData, {
        'check npm install': {
            describe: '',
            state: 'warn',
            link: [
                {
                    name: t('Click to test'),
                    title: t('Click to test') + ' npm install',
                    type: 'test-npm-install',
                },
            ],
        },
    })
}

/**
 * ??????npm install
 */
const axiosNpmTestInstall = () => {
    state.checkDoneIndex = 'executing'
    state.checkTypeIndex = 'npminstall'
    closeTableLabel('check npm install')
    terminal.toggle(true)
    terminal.addTaskPM('test-install', true, (res: number) => {
        checkSubmit()
        terminal.toggle(false)
        if (res == taskStatus.Failed) {
            let npmInstall = {
                'test-npm-install': {
                    describe: t('Command execution test failed'),
                    state: 'warn',
                    link: [
                        {
                            // ????????????
                            name: t('How to solve'),
                            title: t('Click to see how to solve it'),
                            type: 'faq',
                            url: 'https://wonderful-code.gitee.io/guide/install/npmInstallFail.html',
                        },
                    ],
                },
            }
            state.envCheckData = Object.assign({}, state.envCheckData, npmInstall)
        } else if (res == taskStatus.Success) {
            let npmInstall = { 'test-npm-install': { describe: t('Can execute'), state: 'ok', link: [] } }
            state.envCheckData = Object.assign({}, state.envCheckData, npmInstall)
        }
    })
}

/**
 * ??????table?????????
 */
const closeTableLabel = (idx: any) => {
    delete state.envCheckData[idx]
}

/**
 * ????????????????????????
 */
const checkSubmit = () => {
    state.checkTypeIndex = 'done'
    let dataKey = ['php_version', 'config_is_writable', 'public_is_writable', 'php-mysqli']
    for (const key in dataKey) {
        if (!state.envCheckData[dataKey[key] as any] || state.envCheckData[dataKey[key] as any]['state'] != 'ok') {
            state.checkDoneIndex = 'fail'
            return false
        }
    }
    state.checkDoneIndex = 'ok'
    return true
}

const getAmicablePackageManager = () => {
    if (terminal.state.packageManager == 'none') {
        return t('None - manual execution')
    } else {
        return terminal.state.packageManager
    }
}

const getUrlPort = (): string => {
    let value: string = import.meta.env.VITE_AXIOS_BASE_URL as string
    value = value == 'getCurrentDomain' || !value ? window.location.protocol + '//' + window.location.host : value
    return new URL(value).port
}

onMounted(() => {
    if (!common.state.showStartDialog) {
        startInstall()
    }

    if (getUrlPort() != '8000') {
        state.showPortErrorPrompt = true
    }
})
</script>

<style scoped lang="scss">
.container {
    margin-top: 20px;
    .table-title {
        display: block;
        text-align: center;
        font-size: 20px;
        color: #303133;
    }
    .table {
        max-width: 560px;
        padding: 20px;
        margin: 10px auto;
    }
    .global-warning {
        margin-bottom: 10px;
    }
    .table-item {
        color: #303133;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: #fff;
        padding: 13px 15px;
        margin-bottom: 2px;
        border-radius: 5px;
        transition: all 0.2s ease;
        &:hover {
            background-color: #fcfcfc;
        }
        .table-label {
            font-size: 15px;
        }
        .label-need {
            font-size: 12px;
            color: #f56c6c;
            cursor: pointer;
            padding: 0 4px;
        }
        .label-need.faq,
        .label-need.install-cnpm {
            color: #3f6ad8;
            &:hover {
                text-decoration: underline;
            }
        }
        .label-need.text {
            cursor: text;
        }
    }
    .table-item.error {
        background-color: #f56c6c;
        color: #fff;
    }
    .table-item.success {
        background-color: #67c23a;
        color: #fff;
    }
    .table-value {
        font-size: 13px;
        display: flex;
        align-items: center;
    }
    .data-state {
        width: 20px;
        height: 20px;
        user-select: none;
        margin-left: 5px;
    }
}
.check-done {
    font-size: 14px;
    margin-top: 20px;
    text-align: right;
}
.check-done.ok {
    color: #67c23a;
}
.check-done.fail {
    color: #f56c6c;
}
.button {
    padding: 15px;
    text-align: center;
    font-size: 16px;
    background-color: #3f6ad8;
    border-radius: 5px;
    color: #fff;
    margin-top: 20px;
    opacity: 0.4;
    cursor: pointer;
    transition: all 0.2s ease;
}
.button.pass {
    opacity: 1;
}
.start-install {
    margin-left: 10px;
}
.w100 {
    width: 100%;
}
.start-from :deep(.el-input__inner) {
    line-height: 29px;
}
.block-help {
    font-size: 13px;
    color: #606266;
    padding-top: 5px;
    line-height: 15px;
}
</style>
